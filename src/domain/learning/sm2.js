/**
 * SM-2 Spaced Repetition Algorithm for LifeOS Flashcards
 * Based on SuperMemo-2
 */

/**
 * Calculates the next review date and updated SM-2 variables for a flashcard.
 * 
 * @param {Object} card - The current flashcard state
 * @param {number} card.ef - Current Easiness Factor (default 2.5)
 * @param {number} card.interval - Current interval in days (default 0)
 * @param {number} card.reps - Number of consecutive successful repetitions (default 0)
 * @param {number} quality - User's self-assessed quality of recall (0-5)
 *   0: Complete blackout
 *   1: Incorrect, but remembered the correct answer once revealed
 *   2: Incorrect, but seems easy to recall
 *   3: Correct, but required significant effort
 *   4: Correct, after hesitation
 *   5: Perfect recall
 * @returns {Object} Updated { ef, interval, reps, nextReviewDate }
 */
/**
 * reviewCard function
 * @param {any} card, quality, today = new Date().toISOString().split('T')[0]
 * @returns {any}
 */
export function reviewCard(card, quality, today = new Date().toISOString().split('T')[0]) {
  let { ef = 2.5, interval = 0, reps = 0 } = card;

  if (quality >= 3) {
    // Correct response
    if (reps === 0) {
      interval = 1;
    } else if (reps === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * ef);
    }
    reps += 1;
  } else {
    // Incorrect response
    reps = 0;
    interval = 1;
  }

  // Update Easiness Factor
  ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (ef < 1.3) ef = 1.3;

  // Calculate next review date
  const nextDate = new Date(today);
  nextDate.setDate(nextDate.getDate() + interval);
  
  return {
    ef,
    interval,
    reps,
    nextReviewDate: nextDate.toISOString().split('T')[0]
  };
}


