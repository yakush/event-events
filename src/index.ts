export function testMe(fail: boolean) {
  if (fail) {
    throw Error('oops');
  }

  return "OK"
}

export {};
