export enum LogLevel {
    INFO = "INFO",
    ACTION = "ACTION",
    EVENT = "EVENT",
    ERROR = "ERROR",
  }
  
  type LogEntry = {
    timestamp: number;
    level: LogLevel;
    source: "client" | "host" | "system";
    gamePhase?: string;
    payload: any;
  };
  
  class GameLogger {
    private logs: LogEntry[] = [];
    private maxLogs = 2000; // Prevent memory bloat
    private enabled = true;
  
    log(level: LogLevel, source: "client" | "host" | "system", payload: any, gamePhase?: string) {
      if (!this.enabled) return;
      
      const entry: LogEntry = {
        timestamp: Date.now(),
        level,
        source,
        gamePhase,
        payload,
      };
      
      this.logs.push(entry);
      
      // Keep only last maxLogs entries
      if (this.logs.length > this.maxLogs) {
        this.logs = this.logs.slice(-this.maxLogs);
      }
      
      // Console output with emoji for easy scanning
      const emoji = level === LogLevel.ACTION ? "🎮" : level === LogLevel.EVENT ? "📡" : level === LogLevel.ERROR ? "❌" : "ℹ️";
      const phaseStr = gamePhase ? `[${gamePhase}] ` : "";
      console.log(`${emoji} ${phaseStr}[${source}] ${level}:`, payload);
    }
  
    action(source: "client" | "host" | "system", action: string, details?: any, gamePhase?: string) {
      this.log(LogLevel.ACTION, source, { action, details }, gamePhase);
    }
  
    event(source: "client" | "host" | "system", eventType: string, data?: any, gamePhase?: string) {
      this.log(LogLevel.EVENT, source, { eventType, data }, gamePhase);
    }
  
    error(source: "client" | "host" | "system", error: string, context?: any, gamePhase?: string) {
      this.log(LogLevel.ERROR, source, { error, context }, gamePhase);
    }
  
    getLogs() {
      return [...this.logs];
    }
  
    exportLogs() {
      return JSON.stringify(this.logs, null, 2);
    }
  
    downloadLogs() {
      const blob = new Blob([this.exportLogs()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `firechick-log-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  
    reset() {
      this.logs = [];
    }
  
    disable() {
      this.enabled = false;
    }
  
    enable() {
      this.enabled = true;
    }
  }
  
  export const gameLogger = new GameLogger();