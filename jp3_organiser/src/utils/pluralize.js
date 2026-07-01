export function pluralize(n, word) {
  return `${n} ${word}${n !== 1 ? 's' : ''}`;
}

export default pluralize;
