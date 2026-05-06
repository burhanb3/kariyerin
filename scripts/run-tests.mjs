const testFiles = [
  '../tests/difficulty.test.ts',
  '../tests/scoring.test.ts',
  '../tests/leaderboard.test.ts',
  '../tests/eventScores.test.ts'
];

for (const file of testFiles) {
  await import(new URL(file, import.meta.url));
}
