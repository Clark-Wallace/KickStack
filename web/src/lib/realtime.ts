export interface RealtimeChange {
  type: 'change' | 'connected' | 'error';
  table?: string;
  op?: 'insert' | 'update' | 'delete';
  id?: number | string;
  ts?: number;
  changeId?: number;
}

export interface RealtimeOptions {
  tables: string[];
  since?: number;
  onMessage: (change: RealtimeChange) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

export class RealtimeClient {
  private ws: WebSocket | null = null;
  private options: RealtimeOptions;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private url: string;
  private isConnecting = false;

  constructor(options: RealtimeOptions) {
    this.options = options;
    const params = new URLSearchParams({
      table: options.tables.join(','),
      ...(options.since && { since: options.since.toString() })
    });
    const realtimeBase = process.env.NEXT_PUBLIC_REALTIME_WS || 'ws://localhost:8081';
    this.url = `${realtimeBase}?${params.toString()}`;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('Realtime connection established');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.options.onConnect?.();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.options.onMessage(data);
        } catch (error) {
          console.error('Failed to parse realtime message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
        this.options.onError?.(new Error('WebSocket connection error'));
      };

      this.ws.onclose = () => {
        console.log('Realtime connection closed');
        this.isConnecting = false;
        this.options.onDisconnect?.();
        this.scheduleReconnect();
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.isConnecting = false;
      this.options.onError?.(error as Error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      30000
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      this.connect();
    }, delay);
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.reconnectAttempts = 0;
    this.isConnecting = false;
  }

  subscribe(table: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe', table }));
    }
  }

  unsubscribe(table: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'unsubscribe', table }));
    }
  }

  ping(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'ping' }));
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}