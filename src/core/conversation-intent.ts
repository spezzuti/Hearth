import type { AgentKey } from "../shared/contracts";

const casualSocialPatterns = [
  /^(?:hi|hey|hello|yo|sup)[\s!,.?]*$/,
  /^(?:(?:hi|hey|hello|yo)[,\s]+)?(?:good\s+)?(?:morning|afternoon|evening|night)[\s!,.?]*$/,
  /^(?:(?:hi|hey|hello|yo)[,\s]+)?(?:how(?:'re| are) you(?: doing| feeling)?|how have you been|how's it going|how is it going|how are things|how's your day|how is your day|what's up|what is up|you (?:doing|feeling) (?:ok|okay|alright|good|fine)|doing (?:ok|okay|alright|good|fine)|you (?:ok|okay|alright|good))(?:\s+(?:today|tonight|this\s+[a-z]+))?[\s!,.?]*$/
];

export function isCasualSocialTurn(text: string): boolean {
  const normalized = text
    .trim()
    .toLocaleLowerCase()
    .replaceAll("’", "'");
  if (!normalized || normalized.length > 160) return false;
  return casualSocialPatterns.some((pattern) => pattern.test(normalized));
}

export function localSocialReply(agent: AgentKey): string {
  if (agent === "maker") return "Yeah, I’m doing alright. How about you?";
  if (agent === "critic") return "Doing alright. You?";
  if (agent === "librarian") return "Yeah, I’m doing okay. How are you?";
  return "I’m good. How are you doing?";
}
