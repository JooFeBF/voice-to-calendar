export class RetryService {
  static async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number,
    delay: number
  ): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.log(`Attempt ${attempt} failed:`, lastError.message);
        
        if (attempt < maxRetries) {
          const waitTime = delay * Math.pow(2, attempt - 1);
          console.log(`Retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    throw lastError;
  }
}
