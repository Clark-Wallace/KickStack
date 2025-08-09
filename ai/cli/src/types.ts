export interface NLTableSpec {
  raw: string;
}

export interface TableSQL {
  tableName: string;
  sql: string;
}

export interface ModelAdapter {
  nlToCreateTable(spec: NLTableSpec): Promise<TableSQL>;
  isAvailable(): Promise<boolean>;
}