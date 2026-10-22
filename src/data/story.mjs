// The story (2026-10-22, project owner: "What's the story? We started this
// game with a One Piece / Locke & Key idea and it feels like neither").
//
// One Piece gives it the shape: a young captain, a found family of
// colourful misfits gathered island by island, rival captains, and a
// legendary treasure at the end. Locke & Key gives it the heart: a family
// of keepers, magic keys that each hold a power, and a voice in the dark
// that wants them turned.
//
// THE WORLD. The sea was once ringed by the Great Reef, a living coral
// crown grown around the Heartlock: a door on the sea floor that keeps the
// Undertow (the hungry dark under the world) shut. The Marlowe family kept
// its keys. Twenty years ago someone turned one. The Reef shattered into
// ten seas, the ten keys were flung out with the shards, and whatever
// swallowed or stole a key was changed by it. That's where the bosses come
// from. The Undertow has leaked ever since: storms, ghosts, the Drowned.
//
// THE LOOP. You are the youngest Marlowe. Nana Isolde gives you the Anchor
// Key, which "always brings a Marlowe home": when you sink, it pulls you
// back to Keyhouse Cove (the harbour). That's why you can try again, and
// Nana has something to say about whatever sank you (after Hades).
//
// Data only: engine/story.mjs decides what to show; ui/storyScene.mjs
// shows it. Portraits are assets/portraits/<id>.png when they exist; until
// then each character shows its emoji on its colour.

export const CHARACTERS = {
  captain: { id: 'captain', name: 'Captain Marlowe', title: 'The youngest Marlowe', emoji: '🧭', colour: '#d8483a', bio: 'Raised at Keyhouse Cove on salt, stories and biscuits. Carries the Anchor Key on a cord round the neck.' },
  nana: { id: 'nana', name: 'Nana Isolde', title: 'Keeper of Keyhouse Cove', emoji: '👵', colour: '#6d5bd0', bio: 'The last Keeper. Sailed with the Great Reef crew before it broke. Knows more than she tells, and tells you anyway.' },
  barnaby: { id: 'barnaby', name: 'Barnaby Crump', title: 'Cook', emoji: '🍲', colour: '#e8913a', bio: 'Round, loud and kind. Cooked for your grandfather. Loads the grapeshot with whatever cutlery is to hand.' },
  juno: { id: 'juno', name: 'Juno Flint', title: 'Gunner', emoji: '🎯', colour: '#e0473f', bio: 'Vesper Gloam\'s best gunner until she asked for wages. Never misses. Hardly ever misses.' },
  ottoline: { id: 'ottoline', name: 'Professor Ottoline Quill', title: 'Navigator & scholar', emoji: '🦉', colour: '#3f8fd6', bio: 'Keeper of the Sharkstooth lighthouse and the Reef Archive. Has a theory about everything, and a hat for every theory.' },
  skerry: { id: 'skerry', name: 'Skerry', title: 'Selkie lookout', emoji: '🦭', colour: '#5fb7c9', bio: 'Seal by morning, girl by night, cross all day. The fastest swimmer you will ever meet.' },
  hollis: { id: 'hollis', name: 'Hollis the Unburied', title: 'Ghost navigator', emoji: '👻', colour: '#8fd3c4', bio: 'Your grandfather\'s cabin boy. Drowned when the Reef broke. Refuses, politely, to stay down.' },
  cinder: { id: 'cinder', name: 'Cinder', title: 'Salamander shipwright', emoji: '🦎', colour: '#f26a2e', bio: 'A fire-lizard kid with a hammer and no patience. Can fix anything. Sets most of it on fire first.' },
  moth: { id: 'moth', name: 'Moth', title: 'Lantern-keeper', emoji: '🕯️', colour: '#c9a43c', bio: 'Blind since birth, keeper of the last lanterns in the Hollow Deep. Feels the dark coming before anyone sees it.' },
  bram: { id: 'bram', name: 'Bram Toadwhistle', title: 'Herbalist', emoji: '🐸', colour: '#5aa83f', bio: 'A frog doctor from Blackroot Bayou. Brews a cure for everything except the hiccups, which he has.' },
  brassbottom: { id: 'brassbottom', name: 'Brassbottom', title: 'Deep diver', emoji: '🦀', colour: '#b9873f', bio: 'A hermit crab in a brass diving helmet. Has dived the Abyss for forty years. SPEAKS LIKE THIS.' },
  saffi: { id: 'saffi', name: 'Saffi Dunerunner', title: 'Sand-sailor', emoji: '🏜️', colour: '#e3b04b', bio: 'Captain of the fastest sand-skiff in the Ossuary Dunes. Thinks water is for amateurs.' },
  glim: { id: 'glim', name: 'Glim', title: 'Crystal sprite', emoji: '💎', colour: '#b48cf0', bio: 'Part sprite, part rock, all enthusiasm. Hums when the keys are near.' },
  vesper: { id: 'vesper', name: 'Vesper Gloam', title: 'Captain of the Black Gale', emoji: '🏴‍☠️', colour: '#3a2f45', bio: 'The most feared captain on the Reef. Wants the ten keys. Wants something else far more.' },
  steele: { id: 'steele', name: 'Admiral Corwin Steele', title: 'Iron Accord', emoji: '⚔️', colour: '#5d6b7a', bio: 'Commander of the Iron Accord fleet. Believes the keys belong to whoever can keep order with them. Him.' },
  undertow: { id: 'undertow', name: 'The Undertow', title: '...', emoji: '🌑', colour: '#14121c', bio: 'The voice under the sea. It counts the keys as you find them.' },
  narrator: { id: 'narrator', name: '', title: '', emoji: '📜', colour: '#2b3a4f', bio: '' },
};

// Lines are [speakerId, text]. Keep each under ~110 characters: they're
// read on a phone, one at a time.
export const PROLOGUE = [
  ['nana', 'Wake up, little Marlowe. The tide ran backwards last night. It hasn\'t done that in twenty years.'],
  ['captain', 'Backwards? Tides don\'t run—'],
  ['nana', 'They do when the Heartlock stirs. Here. Your grandfather\'s key.'],
  ['narrator', 'The Anchor Key is cold as deep water. It hums when you hold it.'],
  ['nana', 'Whatever sinks you, this brings you home. It always brings a Marlowe home.'],
  ['barnaby', 'And I\'m coming too! Somebody has to feed you. Biscuits are aboard, Cap\'n!'],
  ['nana', 'Ten keys were lost when the Reef broke. Bring them home before someone else turns them.'],
];

// One chapter per stage (stage 1-10). `key` is the key its boss holds;
// `recruit` joins the crew when the boss first sinks.
export const CHAPTERS = [
  {
    stage: 1, title: 'The Corsair Keys', key: 'tide', recruit: 'juno', villain: 'vesper',
    intro: [
      ['nana', 'First stop, the Corsair Keys. Pirates, sunshine, and a ship with black sails.'],
      ['barnaby', 'The Black Gale! That\'s Vesper Gloam\'s ship. She eats cooks for breakfast, Cap\'n.'],
      ['nana', 'She has the Tide Key. I\'d know its pull anywhere. Take it back.'],
    ],
    outro: [
      ['vesper', 'Not bad, little Marlowe. Keep the Tide Key. I\'ll take the other nine.'],
      ['narrator', 'The Black Gale limps into the mist. Something rattles in the wreckage.'],
      ['juno', 'Oi! You! Get me out of this cage! Vesper locked up her best gunner for asking for wages.'],
      ['juno', 'Juno Flint. I never miss. Well. Hardly. Take me aboard and I\'ll prove it.'],
      ['undertow', '...one...'],
    ],
  },
  {
    stage: 2, title: 'Sharkstooth Cove', key: 'storm', recruit: 'ottoline',
    intro: [
      ['juno', 'Sharkstooth Cove. Cliffs, wrecks, and sharks the size of chapels.'],
      ['ottoline', 'Ahoy, the boat! Professor Ottoline Quill, keeper of this lighthouse and of the Reef Archive!'],
      ['ottoline', 'The Matriarch swallowed a key twelve years ago and hasn\'t stopped growing since. Fascinating! Also terrifying.'],
    ],
    outro: [
      ['ottoline', 'The Storm Key! Do you know what this means? The keys can be brought home!'],
      ['ottoline', 'I\'m coming with you. I\'ll fetch my hat. And my other hat.'],
      ['undertow', '...two... turn them, little Marlowe...'],
    ],
  },
  {
    stage: 3, title: 'Frostfang Fjord', key: 'frost', recruit: 'skerry',
    intro: [
      ['ottoline', 'Frostfang Fjord. The Frost Key froze the whole fjord around itself. Something big sleeps in the ice.'],
      ['skerry', 'It isn\'t asleep. It\'s waiting. My family left these waters because of it.'],
      ['skerry', 'I\'m Skerry. Wake it, and I\'ll help you sink it.'],
    ],
    outro: [
      ['skerry', 'The fjord is melting. My family can come home.'],
      ['skerry', '...I\'m staying aboard, though. Someone has to keep the cook away from the fish.'],
      ['barnaby', 'I heard that!'],
      ['undertow', '...three...'],
    ],
  },
  {
    stage: 4, title: 'The Wreckers\' Graveyard', key: 'ghost', recruit: 'hollis', villain: 'vesper',
    intro: [
      ['nana', 'The Graveyard. This is where the Reef broke. Where your grandfather... well. Mind the fog.'],
      ['hollis', 'Evening! Don\'t mind me, I\'m only dead. Name\'s Hollis. I\'ve haunted this wreck for twenty years.'],
      ['hollis', 'The Admiral won\'t let any of us rest. He holds the Ghost Key, and the Ghost Key holds us.'],
    ],
    outro: [
      ['hollis', 'He\'s gone. The others are going home. Into the light, or the Undertow... I\'m not sure which.'],
      ['hollis', 'I\'m staying. Your grandfather was my captain, Marlowe. I\'d like to finish the voyage.'],
      ['vesper', 'Four keys. You\'re making this easy. You carry them all to one place, and I collect.'],
      ['undertow', '...four... she is right...'],
    ],
  },
  {
    stage: 5, title: 'The Emberforge', key: 'ember', recruit: 'cinder',
    intro: [
      ['cinder', 'Hey! Big boat! You\'re sailing into my volcano. Rude. Also brave. Mostly rude.'],
      ['cinder', 'The Wyrm sleeps on the Ember Key. Every time it snores, my workshop catches fire.'],
    ],
    outro: [
      ['cinder', 'You beat the Wyrm! Now I can finish my boat. Or... I could fix YOURS. It\'s leaking. Badly.'],
      ['undertow', '...five... halfway home...'],
    ],
  },
  {
    stage: 6, title: 'The Hollow Deep', key: 'lantern', recruit: 'moth',
    intro: [
      ['moth', 'Lights low, voices low. The Hollow King eats light. He ate the sun down here a long time ago.'],
      ['moth', 'I\'m Moth. I keep the last lanterns lit. I can\'t see them... but I can feel the dark.'],
    ],
    outro: [
      ['moth', 'The Lantern Key... it\'s warm. I think I can see something. Is that... colour?'],
      ['moth', 'Take me with you. I want to see the sea.'],
      ['undertow', '...six... the dark remembers you, Marlowe...'],
    ],
  },
  {
    stage: 7, title: 'Blackroot Bayou', key: 'mire', recruit: 'bram', villain: 'steele',
    intro: [
      ['bram', 'Ribbit. Sorry. Habit. Bram Toadwhistle, herbalist, at your service.'],
      ['bram', 'Old Mother Mire brews with the Mire Key. Half my patients are frogs now. The other half always were.'],
    ],
    outro: [
      ['bram', 'The bayou can breathe again. I\'ll pack my remedies. You lot clearly need a doctor.'],
      ['steele', 'Captain Marlowe. The Iron Accord requests you surrender those keys. Requests. For now.'],
      ['undertow', '...seven...'],
    ],
  },
  {
    stage: 8, title: 'The Drowned Abyss', key: 'deep', recruit: 'brassbottom',
    intro: [
      ['ottoline', 'The Abyss. The Heartlock is somewhere beneath us. Can anyone else hear whispering?'],
      ['hollis', 'Always.'],
      ['brassbottom', '*CLANK* GREETINGS, SURFACE PERSONS. I AM BRASSBOTTOM. I HAVE DIVED HERE FOR FORTY YEARS. I AM A CRAB.'],
    ],
    outro: [
      ['brassbottom', 'THE DEEP MOTHER IS DEFEATED. I HAVE SEEN THE HEARTLOCK. IT IS OPEN. A CRACK.'],
      ['brassbottom', 'I WILL COME WITH YOU. THE ABYSS IS VERY BORING NOW.'],
      ['undertow', '...eight... come down, Marlowe. Come down and turn them...'],
    ],
  },
  {
    stage: 9, title: 'The Ossuary Dunes', key: 'bone', recruit: 'saffi', villain: 'vesper',
    intro: [
      ['saffi', 'You sail on water? Cute. Out here we sail on sand. Saffi Dunerunner, fastest skiff in the Dunes.'],
      ['saffi', 'The Dunemaw ate my father\'s caravan, and the Bone Key with it. I want them both back.'],
    ],
    outro: [
      ['saffi', '...Thanks, Captain. I\'ll ride with you. Sand or sea, I\'m still faster than all of you.'],
      ['vesper', 'Nine. One more and the Heartlock opens. I\'ll be waiting at the Prism Lagoon.'],
      ['undertow', '...nine...'],
    ],
  },
  {
    stage: 10, title: 'The Prism Lagoon', key: 'prism', recruit: 'glim', villain: 'vesper',
    intro: [
      ['glim', 'Hi hi hi! I\'m Glim! I\'m a sprite! I\'m also a rock! Mostly a sprite!'],
      ['glim', 'The Colossus grew round the last key. It thinks it\'s a mountain. It isn\'t. It\'s a bully.'],
      ['vesper', 'Last key, Marlowe. When you take it, I take them all.'],
    ],
    outro: [
      ['glim', 'Ten keys! Oooh, listen. They\'re all humming the same note.'],
      ['vesper', 'Hand them over. The Undertow promised me my sister back. I\'ve waited twenty years.'],
      ['nana', 'Vesper. It lied to you then and it\'s lying now. I was there. I held her hand when the Reef broke.'],
      ['vesper', '...Isolde?'],
      ['undertow', 'TEN. TURN THEM. TURN THEM ALL.'],
      ['narrator', 'The sea goes dark. Something vast rises under the Reef. Your voyage isn\'t over, Captain.'],
    ],
  },
];

export const CHAPTER_BY_STAGE = Object.fromEntries(CHAPTERS.map((c) => [c.stage, c]));

// Past the last chapter the Undertow's tide runs on: a short beat for each
// new stage, so the endless stages still have a voice.
export const UNDERTOW_TIDE = [
  ['undertow', 'Deeper, little Marlowe. There is always deeper.'],
  ['nana', 'Every stage past the Reef is the Undertow pushing back. Push harder.'],
  ['hollis', 'It\'s getting colder down here. I didn\'t think I could feel cold any more.'],
  ['glim', 'The keys are humming louder. Is that good? It feels like it should be good.'],
  ['undertow', 'You cannot hold the door forever.'],
];

// Nana's word when the Anchor Key drags you home (after Hades: dying is a
// story beat). {enemy} is whatever hurt you last; {level} the level.
export const NANA_SUNK = [
  'The key dragged you home again. A {enemy}, was it? Hit it before it hits you.',
  'Salt in your hair and a hole in your hull. {enemy}s were always trouble. Go again.',
  'Your grandfather lost a rudder to a {enemy} once. Twice. Don\'t tell him I told you.',
  'Back so soon? The Anchor Key will wear a groove in the harbour at this rate.',
  'Sunk by a {enemy}? Barnaby, put the kettle on. And the patches.',
  'Every Marlowe sinks. The good ones sail out again before the tea\'s cold.',
];
export const NANA_WON = [
  'Level {level} cleared! Your grandfather would have whooped loud enough to wake the gulls.',
  'Look at you, coming home with a full hold. Spend it wisely. Or on hats. Ask Ottoline.',
  'The Reef feels a little less broken today. That\'s your doing.',
];
export const NANA_IDLE = [
  'The tide\'s turning, Captain. Somewhere out there a key is calling.',
  'A good captain keeps a good crew fed. And a good cook keeps a good captain humble.',
  'Ten keys. One door. And something behind it that should stay there.',
  'The Anchor Key always brings a Marlowe home. Don\'t make it work too hard.',
];

export const KEY_FOR_STAGE = Object.fromEntries(CHAPTERS.map((c) => [c.stage, c.key]));
export const RECRUIT_FOR_STAGE = Object.fromEntries(CHAPTERS.map((c) => [c.stage, c.recruit]));
