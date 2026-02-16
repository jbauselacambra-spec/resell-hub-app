class LogService {
  static logs = [];
  static listeners = [];

  static add(message) {
    const entry = {
      id: Date.now().toString() + Math.random(),
      time: new Date().toLocaleTimeString(),
      text: message,
      type: message.includes('❌') ? 'error' : message.includes('✅') ? 'success' : 'info'
    };
    this.logs.unshift(entry);
    console.log(`[LOG] ${message}`);
    
    // Limitar a 100 logs para no saturar la memoria
    if (this.logs.length > 100) this.logs.pop();
    
    // Avisar a la pantalla si está abierta para que se actualice
    this.listeners.forEach(listener => listener(this.logs));
  }

  static subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  static clear() {
    this.logs = [];
    this.listeners.forEach(listener => listener(this.logs));
  }
}

export default LogService;