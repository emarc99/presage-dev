import type { GazeZone } from '../types/signals';

export interface SceneBeat {
  main: string;
  hidden: string;
}

export interface SceneDefinition {
  index: number;
  id: 'morning-steam' | 'last-train' | 'empty-desk' | 'two-chairs' | 'open-doorway';
  roman: string;
  title: string;
  subtitle: string;
  baseHz: number;
  zoneLabels: Record<GazeZone, string>;
  zoneNotes: Record<GazeZone, string>;
  beats: [SceneBeat, SceneBeat, SceneBeat];
}

export const SCENES: SceneDefinition[] = [
  {
    index: 0,
    id: 'morning-steam',
    roman: 'I',
    title: 'Morning Steam',
    subtitle: 'Kitchen table · 06:14 AM',
    baseHz: 196.0, // G3
    zoneLabels: {
      left: 'Venetian Blinds',
      center: 'Ceramic Cup',
      right: 'Folded Note',
    },
    zoneNotes: {
      left: 'Dust rises slowly through four narrow bands of early light.',
      center: 'Steam still curls off the dark surface untouched since six.',
      right: 'Half a sentence pressed into napkin paper beside the spoon.',
    },
    beats: [
      {
        main: 'First light slips between the blind slats onto an empty kitchen table. Nobody has spoken yet; the kettle only stopped whistling a minute ago.',
        hidden: 'Marginalia developed: “You meant to finish packing last night, then stood here twenty minutes just listening to the refrigerator hum.”',
      },
      {
        main: 'Steam thins into pale spirals above the ceramic rim. Wherever you rest your eyes longest stays crisp while the rest of the room softens.',
        hidden: 'Marginalia developed: “Under the saucer edge rests a folded receipt dated two Fridays back—the only afternoon it didn’t rain.”',
      },
      {
        main: 'A cool breeze crosses the sill and breaks the last thread of vapor. One blink seals the kitchen before the corridor opens.',
        hidden: 'Marginalia developed: “At the margin of the note, three words had been crossed out lighter than the rest.”',
      },
    ],
  },
  {
    index: 1,
    id: 'last-train',
    roman: 'II',
    title: 'The Last Train North',
    subtitle: 'Local carriage · 00:42 AM',
    baseHz: 220.0, // A3
    zoneLabels: {
      left: 'Luggage Rack',
      center: 'Platform Clock',
      right: 'Platform 04 Sign',
    },
    zoneNotes: {
      left: 'One leather satchel wedged under an amber reading lamp cone.',
      center: 'The illuminated station dial freezes at 00:42 behind wet glass.',
      right: 'Blue-and-white enameled station lettering slides past in rain.',
    },
    beats: [
      {
        main: 'Rain needles the coach glass while city lamps smear across your reflection. Glance left toward the brass rack, or steady your breath to bring the station clock into sharp relief.',
        hidden: 'Marginalia developed: “You packed only one winter coat and left the spare house key under the chipped ceramic pot.”',
      },
      {
        main: 'Past the marshland overpass, amber signals thin out one by one. Your silhouette clears against the dark window whenever the train coasts between poles.',
        hidden: 'Marginalia developed: “Nobody waved at platform three, yet two untouched seats stayed warm across from yours.”',
      },
      {
        main: 'Brakes sigh beneath the steel floorboards. Pale morning glints off the station board a split second before your eyes shut.',
        hidden: 'Marginalia developed: “The handwritten note in your pocket only made sense once you stopped rereading its first line.”',
      },
    ],
  },
  {
    index: 2,
    id: 'empty-desk',
    roman: 'III',
    title: 'The Empty Desk',
    subtitle: 'After hours · Floor 04',
    baseHz: 174.61, // F3
    zoneLabels: {
      left: 'Hallway Coat Hook',
      center: 'Open Notebook',
      right: 'Night Window',
    },
    zoneNotes: {
      left: 'A scarf hangs slack by the ajar office door waiting for tomorrow.',
      center: 'A brass architect lamp throws a sharp triangle over blank graph paper.',
      right: 'Distant rooftop antennae blink softly through city mist.',
    },
    beats: [
      {
        main: 'Everyone cleared out an hour ago. Only the warm cone of the architect lamp marks where someone stayed past dusk.',
        hidden: 'Marginalia developed: “Two drafts lay stacked underneath the blotter—neither sent, both signed.”',
      },
      {
        main: 'Each steady exhale holds the ink lines clear on the open page. Rush your breath and the room retreats into sodium glare.',
        hidden: 'Marginalia developed: “Someone turned the radiator valve down just before locking up so the quiet wouldn’t hiss.”',
      },
      {
        main: 'Across the glass, headlights drift down a wet avenue and vanish behind the brick annex. Blink once to turn down the lamp.',
        hidden: 'Marginalia developed: “Your keys sat beside the inkwell the entire evening, hidden in plain sight.”',
      },
    ],
  },
  {
    index: 3,
    id: 'two-chairs',
    roman: 'IV',
    title: 'Two Chairs',
    subtitle: 'Front room · Late afternoon',
    baseHz: 246.94, // B3
    zoneLabels: {
      left: 'Left Timber Chair',
      center: 'Pendant Sphere',
      right: 'Glass of Water',
    },
    zoneNotes: {
      left: 'Turned fifteen degrees inward, as if someone stood up mid-reply.',
      center: 'A low frosted globe splits the quiet room cleanly down the middle.',
      right: 'Tiny silver bubbles cling to the rim of an untouched glass.',
    },
    beats: [
      {
        main: 'Two chairs face each other beneath a low pendant sphere. Nothing in the frame moves quickly; even dust hangs between the cushions.',
        hidden: 'Marginalia developed: “Notice how the left chair sits inches closer to the table—someone leaned forward first.”',
      },
      {
        main: 'Looking left or right tilts the room around that conversation never quite finished. A calm four-second breath clears the air between them.',
        hidden: 'Marginalia developed: “What stayed unsaid weighed less than the relief of finally sitting down in silence.”',
      },
      {
        main: 'Afternoon sun drops behind the roof ridge, leaving only the overhead globe warm. One final blink carries you to the door.',
        hidden: 'Marginalia developed: “Both coats had already been lifted from the chair backs twenty minutes earlier.”',
      },
    ],
  },
  {
    index: 4,
    id: 'open-doorway',
    roman: 'V',
    title: 'Open Doorway',
    subtitle: 'Threshold · First light',
    baseHz: 261.63, // C4
    zoneLabels: {
      left: 'Stacked Boxes',
      center: 'Sunbeam Threshold',
      right: 'Porch Lantern',
    },
    zoneNotes: {
      left: 'Unmarked twine and cardboard waiting neatly along the baseboard.',
      center: 'A clean trapezoid of morning sun cuts straight across the floorboards.',
      right: 'A warm glass porch bulb still glows out of habit in daylight.',
    },
    beats: [
      {
        main: 'The front latch hangs open an inch, spilling morning light diagonally across bare floorboards. You have reached the final plate of the sitting.',
        hidden: 'Marginalia developed: “Nothing left behind looks hurried; even the taped boxes sit square with the wall.”',
      },
      {
        main: 'Hold one last steady breath inside the threshold. Every earlier pause, glance, and cut waits on the developed contact sheet beyond this blink.',
        hidden: 'Marginalia developed: “Look outside long enough and the porch bulb disappears into clear morning air.”',
      },
      {
        main: 'Air shifts through the frame—crisp street wind meeting warm indoor cedar. Close your eyes when you are ready to develop the roll.',
        hidden: 'Marginalia developed: “Final exposure complete. Your next blink opens the finished contact sheet.”',
      },
    ],
  },
];
