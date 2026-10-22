// The crew (2026-10-22, project owner: "Colourful characters, ships with
// personality!"). One Piece's found family: Barnaby sails with you from
// the start and each stage's chapter brings one more aboard
// (data/story.mjs RECRUIT_FOR_STAGE). Two sail with you at a time (a third
// berth is a late, expensive refit).
//
// Each brings one passive (`fx`, read by engine/depth.mjs) and their own
// voice: barks during play, keyed by event. Sailing together raises their
// bond (engine/depth.mjs): every level cleared with someone aboard counts,
// and each bond level makes their passive 10% stronger, up to level 5.

export const CREW = {
  barnaby: {
    id: 'barnaby', role: 'Cook', passive: 'Grapeshot +15%, and the galley patches 0.3 hull a second',
    fx: { weapon: { grapeshot: 1.15 }, regen: 0.3 },
    barks: {
      start: ['Biscuits are stowed, Cap\'n! Let\'s go!', 'Who\'s hungry? After the fighting. Always after.'],
      boss: ['That\'s a big one. I\'ve got a big pot.', 'Steady, Cap\'n. I\'ve seen worse. Not much worse.'],
      low: ['We\'re taking water! Somebody grab a bucket. Or a ladle!', 'Hold on, I\'ll patch it with a pancake!'],
      evolve: ['Now THAT\'S a recipe!', 'Ooh, that smells like victory.'],
      key: ['Turn it, Cap\'n!', 'Your Nana would be proud.'],
      chest: ['Treasure! Any spoons in there?', 'Ha! Supper\'s on the house tonight!'],
      rush: ['Here they come, a whole shoal of them!', 'Plenty for everyone!'],
    },
  },
  juno: {
    id: 'juno', role: 'Gunner', passive: 'Cannonballs +15%, and a wider raking arc',
    fx: { weapon: { cannonballs: 1.15 }, rakeBonus: 0.14 },
    barks: {
      start: ['Guns loaded. Point me at something.', 'Let\'s make some noise.'],
      boss: ['Big target. Can\'t miss. Won\'t miss.', 'Ooh, I\'ve wanted to shoot one of those.'],
      low: ['Cap\'n, the hull\'s got more holes than my excuses!', 'Get us clear, I\'ll cover!'],
      evolve: ['Look at THAT gun. Mine now.', 'Beautiful. Absolutely beautiful.'],
      key: ['Fancy. Very fancy.', 'Save some for me!'],
      chest: ['Powder! Shot! Dibs!', 'Now we\'re talking.'],
      rush: ['Broadside them! Turn us side-on!', 'Shooting gallery!'],
    },
  },
  ottoline: {
    id: 'ottoline', role: 'Navigator', passive: '+12% sea glass, and the Archive\'s knowledge',
    fx: { xpMult: 1.12 },
    barks: {
      start: ['I\'ve charted these waters! Roughly. Approximately.', 'Fascinating currents today. Also enemies.'],
      boss: ['Remarkable specimen! Please do sink it.', 'According to the Archive, we should run. Ignoring the Archive!'],
      low: ['My notes are getting wet! Also the hull!', 'Captain, the ship is statistically sinking!'],
      evolve: ['Evolution! I must write this down!', 'A new theory of gunnery!'],
      key: ['The key responds to you! As I predicted!', 'Extraordinary!'],
      chest: ['Artefacts! Careful, careful!', 'For the Archive! And also for us.'],
      rush: ['A migrating fleet! How exciting!', 'Mind the shoal!'],
    },
  },
  skerry: {
    id: 'skerry', role: 'Lookout', passive: 'Dash comes back 20% sooner',
    fx: { dashMult: 0.8 },
    barks: {
      start: ['Water\'s good today. Let\'s swim. I mean sail.', 'I\'ll watch the waves.'],
      boss: ['I can smell it from here.', 'Go fast. Go round it. Don\'t stop.'],
      low: ['Dash! Get us out!', 'Faster, Captain, faster!'],
      evolve: ['Huh. Nice.', 'The sea likes that.'],
      key: ['The water\'s listening.', 'Do it again.'],
      chest: ['Shiny. Mine. Ours.', 'I\'ll fetch the next one.'],
      rush: ['Shoal coming! Like herring, but rude.', 'Swim through them!'],
    },
  },
  hollis: {
    id: 'hollis', role: 'Ghost navigator', passive: 'Once a level, a blow that would sink you leaves you at 1 hull',
    fx: { cheatDeath: 1 },
    barks: {
      start: ['Lovely evening for a haunting.', 'Your grandfather always started with a song. I\'ll spare you.'],
      boss: ['I\'ve died to worse. Well. Once.', 'Don\'t worry, if it sinks us I\'ll show you around.'],
      low: ['Trust me, Captain, you don\'t want to join me yet.', 'Hold on! I\'ve got you!'],
      evolve: ['Ooh, spooky. I approve.', 'Now that\'s a ghost of a gun.'],
      key: ['The keys remember your grandfather.', 'I felt that in my bones. Metaphorically.'],
      chest: ['Treasure! I had a chest once. I was buried in it.', 'Can\'t lift it. You\'ll have to.'],
      rush: ['A whole crowd! Reminds me of my funeral.', 'Here they come!'],
    },
  },
  cinder: {
    id: 'cinder', role: 'Shipwright', passive: 'Flame Barrels +25%, and +10 max hull from her patching',
    fx: { weapon: { flame_barrels: 1.25 }, hull: 10 },
    barks: {
      start: ['I fixed the rudder! Mostly. Don\'t turn left.', 'Let\'s set things on fire!'],
      boss: ['It\'s huge! It\'ll burn for HOURS.', 'I\'ve built bigger boats than that. Not really.'],
      low: ['Stop breaking my ship!', 'Hammer! Where\'s my hammer!'],
      evolve: ['Ooooh, can I take it apart later?', 'Hot! Very hot! Good hot!'],
      key: ['Whoa! Do it again!', 'Fire? Is it fire? It should be fire.'],
      chest: ['Parts! Spare parts!', 'I can build something with this!'],
      rush: ['Burn them all! Wait, is that allowed?', 'Here they come!'],
    },
  },
  moth: {
    id: 'moth', role: 'Lantern-keeper', passive: 'Reach for glass and coin +25%, and a brighter lantern in the dark',
    fx: { pickupMult: 1.25, lantern: 1.3 },
    barks: {
      start: ['I can hear the sea breathing.', 'Keep the lanterns lit, Captain.'],
      boss: ['It\'s cold. It\'s so cold. It\'s here.', 'I can feel how big it is.'],
      low: ['Your heartbeat\'s too fast, Captain.', 'Pull back, pull back!'],
      evolve: ['That sounds bright.', 'Warm. Good.'],
      key: ['Light! I felt the light!', 'The keys sing.'],
      chest: ['I heard it clink.', 'Something gold. I can tell.'],
      rush: ['Lots of little heartbeats coming.', 'Left. No, right. No, everywhere.'],
    },
  },
  bram: {
    id: 'bram', role: 'Herbalist', passive: 'Burns, poison and chills wear off twice as fast; +0.2 hull a second',
    fx: { statusFade: 2, regen: 0.2 },
    barks: {
      start: ['Remedies packed. Hiccup tonic packed. *hic*', 'Doctor\'s orders: don\'t sink.'],
      boss: ['Ribbit. Sorry. That\'s fear.', 'I don\'t have a remedy for THAT.'],
      low: ['Hold still, I\'ll poultice the hull!', 'Prescription: run away!'],
      evolve: ['Remarkable growth!', 'A healthy specimen!'],
      key: ['Potent stuff!', 'Croak! I mean, well done!'],
      chest: ['Herbs? No. Gold. Also fine.', 'For the medicine fund!'],
      rush: ['An epidemic of pirates!', 'Here comes the swarm!'],
    },
  },
  brassbottom: {
    id: 'brassbottom', role: 'Deep diver', passive: 'Depth Charges +25%',
    fx: { weapon: { depth_charges: 1.25 } },
    barks: {
      start: ['DIVE STATIONS. I MEAN SAIL STATIONS.', 'THE SURFACE IS VERY BRIGHT.'],
      boss: ['LARGE ENEMY DETECTED. RECOMMEND: EXPLOSIONS.', 'I HAVE SEEN BIGGER. IN THE ABYSS. IT ATE MY HAT.'],
      low: ['WE ARE SINKING. I AM COMFORTABLE WITH THIS. YOU ARE NOT.', 'HULL BREACH. HULL BREACH.'],
      evolve: ['UPGRADE ACKNOWLEDGED.', 'EXCELLENT. CLANK.'],
      key: ['THE KEY HAS BEEN TURNED.', 'IMPRESSIVE, SURFACE PERSON.'],
      chest: ['TREASURE. I WILL WEAR IT AS A SHELL.', 'SHINY.'],
      rush: ['MANY ENEMIES. GOOD. MORE TARGETS.', 'INCOMING SHOAL.'],
    },
  },
  saffi: {
    id: 'saffi', role: 'Sand-sailor', passive: '+8% speed, and Chain Shot +15%',
    fx: { speedMult: 1.08, weapon: { chain_shot: 1.15 } },
    barks: {
      start: ['Try to keep up. Oh wait, you\'re the boat.', 'Wind\'s up. Let\'s fly.'],
      boss: ['I\'ve outrun bigger. Probably.', 'Circle it! Never stop moving!'],
      low: ['Move! Sand doesn\'t sink, but you do!', 'Speed, Captain, speed!'],
      evolve: ['Ha! Nice.', 'Now that\'s fast.'],
      key: ['Show-off.', 'Do that again, I wasn\'t watching.'],
      chest: ['Loot! My favourite kind of sand.', 'Grab it and go!'],
      rush: ['Racing us? Rude.', 'Cut through them!'],
    },
  },
  glim: {
    id: 'glim', role: 'Crystal sprite', passive: 'Your key charges 30% faster',
    fx: { keyCharge: 1.3 },
    barks: {
      start: ['Hi hi hi! Let\'s go go go!', 'The keys are humming! Hmm hmm hmm.'],
      boss: ['It\'s big and grumpy!', 'Ooh, sparkly! No wait, scary!'],
      low: ['Ow ow ow, the ship is hurting!', 'Be careful, be careful!'],
      evolve: ['Sparkly!', 'Ooooh pretty!'],
      key: ['WHEEE!', 'The keys are SO happy!'],
      chest: ['Treasure treasure treasure!', 'Can I keep one? Just one?'],
      rush: ['So many! Hi! Bye!', 'Here they come here they come!'],
    },
  },
};

export const CREW_IDS = Object.keys(CREW);
// Bond: levels cleared together needed for each bond level (1-5).
export const BOND_LEVELS = [3, 8, 16, 28, 45];
export const BOND_BONUS = 0.1; // passive strength per bond level
