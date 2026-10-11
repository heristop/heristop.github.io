// One reading pace for every "N min" on the site: the article meta and the home list must agree
const WORDS_PER_MINUTE = 200;

const countWords = (text: string): number => text.split(/\s+/).length;

const readingMinutes = (words: number): number => Math.ceil(words / WORDS_PER_MINUTE);

export { countWords, readingMinutes, WORDS_PER_MINUTE };
