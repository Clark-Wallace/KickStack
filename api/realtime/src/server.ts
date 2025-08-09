import WebSocket, { WebSocketServer } from 'ws';
import { Client } from 'pg';
import * as http from 'http';
import * as url from 'url';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../infra/.env') });

const PORT = process.env.REALTIME_PORT || 8081;
const POLL_INTERVAL = 500; // ms

interface Change {
  id: number;
  ts: string;
  table_name: string;
  op: string;
  row_pk: string | null;
  payload: any;
}

interface ClientSubscription {
  ws: WebSocket;
  tables: Set<string>;
  lastSeenId: number;
}

class RealtimeServer {
  private wss: WebSocketServer;
  private db: Client;
  private clients: Map<WebSocket, ClientSubscription> = new Map();
  private lastPolledId: number = 0;
  private connectionString: string;

  constructor() {
    // PostgreSQL connection string
    this.connectionString = process.env.KICKSTACK_PG_URI || 
      'postgres://kick:kickpass@localhost:5432/kickstack';

    console.log(`Connecting to PostgreSQL...`);
    
    // Initialize PostgreSQL connection
    this.db = new Client({
      connectionString: this.connectionString
    });

    this.db.connect()
      .then(() => {
        console.log('Connected to PostgreSQL database');
        this.initializeLastPolledId();
      })
      .catch(err => {
        console.error('Failed to connect to database:', err);
        process.exit(1);
      });

    // Create HTTP server
    const server = http.createServer();
    
    // Initialize WebSocket server
    this.wss = new WebSocketServer({ server });
    
    // Start HTTP server
    server.listen(PORT, () => {
      console.log(`Realtime server listening on ws://localhost:${PORT}`);
      console.log(`Connect with: ws://localhost:${PORT}?table=<table_name>&since=<optional_id>`);
    });

    this.setupWebSocketHandlers();
    this.startPolling();
  }

  private async initializeLastPolledId() {
    try {
      const result = await this.db.query('SELECT COALESCE(MAX(id), 0) as max_id FROM kickstack_changes');
      this.lastPolledId = result.rows[0].max_id;
      console.log(`Initialized with last polled ID: ${this.lastPolledId}`);
    } catch (err) {
      console.error('Failed to initialize last polled ID:', err);
    }
  }

  private setupWebSocketHandlers() {
    this.wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
      const query = url.parse(req.url || '', true).query;
      const tables = (query.table as string)?.split(',') || [];
      const since = parseInt(query.since as string) || this.lastPolledId;

      if (tables.length === 0) {
        ws.send(JSON.stringify({ error: 'No tables specified' }));
        ws.close();
        return;
      }

      const subscription: ClientSubscription = {
        ws,
        tables: new Set(tables),
        lastSeenId: since
      };

      this.clients.set(ws, subscription);
      
      console.log(`Client connected: tables=${tables.join(',')}, since=${since}`);
      
      // Send connection confirmation
      ws.send(JSON.stringify({
        type: 'connected',
        tables: Array.from(subscription.tables),
        since: subscription.lastSeenId
      }));

      // Handle client messages (ping/pong, subscription updates)
      ws.on('message', (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());
          if (data.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
          } else if (data.type === 'subscribe' && data.table) {
            subscription.tables.add(data.table);
            ws.send(JSON.stringify({ 
              type: 'subscribed', 
              table: data.table 
            }));
          } else if (data.type === 'unsubscribe' && data.table) {
            subscription.tables.delete(data.table);
            ws.send(JSON.stringify({ 
              type: 'unsubscribed', 
              table: data.table 
            }));
          }
        } catch (err) {
          console.error('Failed to parse client message:', err);
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(`Client disconnected: tables=${tables.join(',')}`);
      });

      ws.on('error', (err) => {
        console.error('WebSocket error:', err);
        this.clients.delete(ws);
      });

      // Send any missed changes since their last seen ID
      this.sendMissedChanges(subscription);
    });
  }

  private async sendMissedChanges(subscription: ClientSubscription) {
    const tables = Array.from(subscription.tables);
    
    const query = `
      SELECT id, ts, table_name, op, row_pk, payload
      FROM kickstack_changes
      WHERE id > $1 AND table_name = ANY($2::text[])
      ORDER BY id ASC
      LIMIT 100
    `;

    try {
      const result = await this.db.query(query, [subscription.lastSeenId, tables]);
      
      result.rows.forEach(row => {
        const message = this.formatChangeMessage(row);
        if (subscription.ws.readyState === WebSocket.OPEN) {
          subscription.ws.send(JSON.stringify(message));
        }
      });

      if (result.rows.length > 0) {
        subscription.lastSeenId = result.rows[result.rows.length - 1].id;
      }
    } catch (err) {
      console.error('Failed to fetch missed changes:', err);
    }
  }

  private startPolling() {
    setInterval(() => {
      this.pollChanges();
    }, POLL_INTERVAL);
  }

  private async pollChanges() {
    // Get all unique tables being watched
    const allTables = new Set<string>();
    this.clients.forEach(client => {
      client.tables.forEach(table => allTables.add(table));
    });

    if (allTables.size === 0) return;

    const tables = Array.from(allTables);
    
    const query = `
      SELECT id, ts, table_name, op, row_pk, payload
      FROM kickstack_changes
      WHERE id > $1 AND table_name = ANY($2::text[])
      ORDER BY id ASC
      LIMIT 100
    `;

    try {
      const result = await this.db.query(query, [this.lastPolledId, tables]);
      
      if (result.rows.length === 0) return;

      // Broadcast changes to relevant clients
      result.rows.forEach(row => {
        const message = this.formatChangeMessage(row);
        
        this.clients.forEach(client => {
          if (client.tables.has(row.table_name) && 
              row.id > client.lastSeenId &&
              client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify(message));
            client.lastSeenId = row.id;
          }
        });
      });

      // Update global last polled ID
      this.lastPolledId = result.rows[result.rows.length - 1].id;
    } catch (err) {
      console.error('Failed to poll changes:', err);
    }
  }

  private formatChangeMessage(change: Change) {
    let payload = change.payload || {};
    
    return {
      type: 'change',
      table: change.table_name,
      op: change.op,
      id: payload.id || change.row_pk,
      ts: parseInt(change.ts),
      changeId: change.id
    };
  }
}

// Start the server
new RealtimeServer();