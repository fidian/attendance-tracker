/**
 * "1 event", "2 events". Small, but the alternative is counting words in
 * three screens' worth of messages and getting one of them wrong.
 */
export const plural = (count: number, one: string, many = `${one}s`) =>
    `${count} ${count === 1 ? one : many}`;
