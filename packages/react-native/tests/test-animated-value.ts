export type TestAnimatedSum = {
  getValue(): number
}

export class TestAnimatedValue {
  private value = 0

  setValue(value: number): void {
    this.value = value
  }

  getValue(): number {
    return this.value
  }
}
