// Role + action definitions for Pecking Order.
// Mechanics follow the classic hidden-role bluffing formula; names, cast and art are our own.
// Action ids (peck, forage, …) are internal and stable; `name` is what players see.

export const ROLE_IDS = ['rooster', 'fox', 'raccoon', 'owl', 'goose'];

export const ROLES = {
  rooster: {
    name: 'Rooster', title: 'The Rooster', bg: '#FFD166', ink: '#D7263D',
    action: 'tribute', blocks: ['forage'],
    power: 'Tax: take 3 corn.', counter: 'Blocks Harvest.',
    quip: 'Pay your corn tax!',
  },
  fox: {
    name: 'Fox', title: 'The Fox', bg: '#2D6A4F', ink: '#F3722C',
    action: 'raid', blocks: [],
    power: 'Attack: pay 3 corn, a rival loses a card.', counter: 'Blocked by the Goose.',
    quip: 'Nothing personal, hen.',
  },
  raccoon: {
    name: 'Raccoon', title: 'The Raccoon', bg: '#9B8EC4', ink: '#4A4E69',
    action: 'pilfer', blocks: ['pilfer'],
    power: 'Snatch: steal 2 corn from a rival.', counter: 'Blocks Snatch.',
    quip: 'Finders keepers.',
  },
  owl: {
    name: 'Owl', title: 'The Owl', bg: '#1D3557', ink: '#C68B59',
    action: 'foresight', blocks: ['pilfer'],
    power: 'Swap: draw 2 cards, keep the best.', counter: 'Blocks Snatch.',
    quip: 'Whooo goes there?',
  },
  goose: {
    name: 'Goose', title: 'The Goose', bg: '#A8DADC', ink: '#F4A261',
    action: null, blocks: ['raid'],
    power: 'No action of its own.', counter: 'Blocks Fox attacks.',
    quip: 'HONK. Not on my watch.',
  },
};

// claim: role you claim to hold; cost: corn paid up front; gain: corn received.
// ask: prompt shown when picking a target; did: past-tense phrase for the game log.
export const ACTIONS = {
  peck:      { name: 'Collect',  claim: null,      cost: 0, gain: 1, target: false, blockedBy: [],                 short: '+1 corn',             did: 'collects 1 corn',  desc: 'Take 1 corn. Nobody can block or challenge it.' },
  forage:    { name: 'Harvest',  claim: null,      cost: 0, gain: 2, target: false, blockedBy: ['rooster'],        short: '+2 corn',             did: 'harvests 2 corn',  desc: 'Take 2 corn. Anyone claiming the Rooster can block it.' },
  barnstorm: { name: 'Knockout', claim: null,      cost: 7, gain: 0, target: true,  blockedBy: [],                 short: 'pay 7 · unstoppable', did: 'knocks out',       ask: 'Who do you knock out?',   desc: 'Pay 7 corn: a rival loses a card. It cannot be blocked or challenged. You must do this if you have 10+ corn.' },
  tribute:   { name: 'Tax',      claim: 'rooster', cost: 0, gain: 3, target: false, blockedBy: [],                 short: '+3 corn',             did: 'taxes',            desc: 'Claim the Rooster: take 3 corn.' },
  raid:      { name: 'Attack',   claim: 'fox',     cost: 3, gain: 0, target: true,  blockedBy: ['goose'],          short: 'pay 3 · hit a rival', did: 'attacks',          ask: 'Who do you attack?',      desc: 'Claim the Fox: pay 3 corn, a rival loses a card. The target can block by claiming the Goose.' },
  pilfer:    { name: 'Snatch',   claim: 'raccoon', cost: 0, gain: 2, target: true,  blockedBy: ['raccoon', 'owl'], short: 'steal 2 corn',        did: 'snatches from',    ask: 'Who do you snatch from?', desc: 'Claim the Raccoon: steal 2 corn from a rival. The target can block by claiming the Raccoon or the Owl.' },
  foresight: { name: 'Swap',     claim: 'owl',     cost: 0, gain: 0, target: false, blockedBy: [],                 short: 'draw 2, keep best',   did: 'swaps cards',      desc: 'Claim the Owl: draw 2 cards from the deck, keep the ones you like, put 2 back.' },
};

export const ACTION_IDS = ['peck', 'forage', 'barnstorm', 'tribute', 'raid', 'pilfer', 'foresight'];

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
