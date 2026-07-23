type RefreshWaiter<T> = {
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

export class RefreshRequestQueue<T> {
  private waiters: RefreshWaiter<T>[] = [];

  wait(): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.waiters.push({ resolve, reject });
    });
  }

  resolve(value: T): void {
    const pending = this.takeAll();
    pending.forEach((waiter) => waiter.resolve(value));
  }

  reject(reason: unknown): void {
    const pending = this.takeAll();
    pending.forEach((waiter) => waiter.reject(reason));
  }

  get size(): number {
    return this.waiters.length;
  }

  private takeAll(): RefreshWaiter<T>[] {
    const pending = this.waiters;
    this.waiters = [];
    return pending;
  }
}
