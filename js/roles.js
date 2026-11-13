// Role + action definitions for Pecking Order.
// Mechanics follow the classic hidden-role bluffing formula; names, cast and art are our own.

export const ROLE_IDS = ['rooster', 'fox', 'raccoon', 'owl', 'goose'];

export const ROLES = {
  rooster: {
    name: 'Rooster', title: 'The Rooster', bg: '#FFD166', ink: '#D7263D',
    action: 'tribute', blocks: ['forage'],
    power: 'Tribute: take 3 corn.', counter: 'Blocks Forage.',
    quip: 'Cock-a-doodle-dues!',
  },
  fox: {
    name: 'Fox', title: 'The Fox', bg: '#2D6A4F', ink: '#F3722C',
    action: 'raid', blocks: [],
    power: 'Raid: pay 3 corn, a rival loses a card.', counter: 'Stopped by the Goose.',
    quip: 'Nothing personal, hen.',
  },
  raccoon: {
    name: 'Raccoon', title: 'The Raccoon', bg: '#9B8EC4', ink: '#4A4E69',
    action: 'pilfer', blocks: ['pilfer'],
    power: 'Pilfer: steal 2 corn from a rival.', counter: 'Blocks Pilfer.',
    quip: "Finders keepers.",
  },
  owl: {
    name: 'Owl', title: 'The Owl', bg: '#1D3557', ink: '#C68B59',
    action: 'foresight', blocks: ['pilfer'],
    power: 'Foresight: draw 2 cards, keep the best.', counter: 'Blocks Pilfer.',
    quip: 'Whooo goes there?',
  },
  goose: {
    name: 'Goose', title: 'The Goose', bg: '#A8DADC', ink: '#F4A261',
    action: null, blocks: ['raid'],
    power: 'No action of its own.', counter: 'Blocks Fox Raids.',
    quip: 'HONK. Not on my watch.',
  },
};

// claim: role you claim to hold; cost: corn paid up front; gain: corn received.
export const ACTIONS = {
  peck:      { name: 'Peck',      claim: null,      cost: 0, gain: 1, target: false, blockedBy: [],                 short: '+1 corn',      desc: 'Take 1 corn. Cannot be blocked or challenged.' },
  forage:    { name: 'Forage',    claim: null,      cost: 0, gain: 2, target: false, blockedBy: ['rooster'],        short: '+2 corn',      desc: 'Take 2 corn. Any Rooster can block it.' },
  barnstorm: { name: 'Barnstorm', claim: null,      cost: 7, gain: 0, target: true,  blockedBy: [],                 short: 'pay 7 · KO',   desc: 'Pay 7 corn: a rival loses a card. Unstoppable. Mandatory at 10+ corn.' },
  tribute:   { name: 'Tribute',   claim: 'rooster', cost: 0, gain: 3, target: false, blockedBy: [],                 short: '+3 corn',      desc: 'Claim Rooster: take 3 corn.' },
  raid:      { name: 'Raid',      claim: 'fox',     cost: 3, gain: 0, target: true,  blockedBy: ['goose'],          short: 'pay 3 · KO',   desc: 'Claim Fox: pay 3 corn, a rival loses a card. The target may block with a Goose.' },
  pilfer:    { name: 'Pilfer',    claim: 'raccoon', cost: 0, gain: 2, target: true,  blockedBy: ['raccoon', 'owl'], short: 'steal 2',      desc: 'Claim Raccoon: steal 2 corn. The target may block with a Raccoon or Owl.' },
  foresight: { name: 'Foresight', claim: 'owl',     cost: 0, gain: 0, target: false, blockedBy: [],                 short: 'swap cards',   desc: 'Claim Owl: draw 2 cards, then return 2.' },
};

export const ACTION_IDS = ['peck', 'forage', 'barnstorm', 'tribute', 'raid', 'pilfer', 'foresight'];

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
