/**
 * Most Likely — blocked words.
 *
 * One lowercase word per entry. These words are:
 *   1. rejected when a kid types them (they get a gentle "try other words"), and
 *   2. zeroed out of the model's spinner BEFORE sampling, with the remaining
 *      chances rescaled to 100%, so a blocked word can never be spun.
 *
 * Matching is on whole words after normalizing (lowercase, punctuation
 * stripped). Simple plurals ("-s", "-es") of a listed word are also caught,
 * so you don't need to list both forms.
 *
 * Known limit: GPT-2 builds rare words from pieces. A blocked word split
 * into fragments across several tokens is not caught, but because only ONE
 * next token is ever shown, a fragment on its own is not the full word.
 *
 * This starter list is intentionally short. Add to it freely.
 */
export const BLOCKLIST: string[] = [
  // profanity
  "fuck", "fucking", "fucked", "fucker", "shit", "shitty", "bullshit", "bitch",
  "bastard", "asshole", "ass", "damn", "dammit", "goddamn", "crap", "piss",
  "pissed", "dick", "cock", "prick", "twat", "wanker", "bollocks", "motherfucker",
  // sexual / anatomy
  "sex", "sexy", "sexual", "porn", "porno", "nude", "naked", "penis", "vagina",
  "boob", "boobs", "tits", "pussy", "cum", "orgasm", "horny", "rape", "raped",
  "rapist", "slut", "whore", "hooker", "prostitute", "erotic", "masturbate",
  "condom", "viagra", "dildo", "anal", "fetish", "pecker", "boner", "titty", "knob",
  // slurs (abbreviated starter set)
  "nigger", "nigga", "fag", "faggot", "dyke", "retard", "retarded", "spic",
  "chink", "kike", "wetback", "tranny",
  // drugs / self-harm
  "cocaine", "heroin", "meth", "suicide",
];
