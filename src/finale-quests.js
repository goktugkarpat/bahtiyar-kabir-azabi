/* KABİR AZABI — chapter V is authored in quests.js.
   The single source of truth preserves all legacy site/save IDs without a second story definition. */
(function () {
  'use strict';
  var B = window.BABA;
  if (!B.Quests || !B.Quests.chapters || !B.Quests.chapters[5]) {
    throw new Error('The Last Court requires its canonical campaign quests.');
  }
}());
