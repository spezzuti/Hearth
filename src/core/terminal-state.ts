const ANSI_CONTROL = /\x1b\[[0-9;?]*[A-Za-z~]/g;
const MISSING_CONVERSATION = /No conversation found with session ID/i;

export interface ClaudeInputObservation {
  buffer: string;
  submitted: boolean;
}

export function observeClaudeInput(
  buffer: string,
  data: string
): ClaudeInputObservation {
  let nextBuffer = buffer;
  let submitted = false;

  for (const character of data) {
    if (character === "\r" || character === "\n") {
      submitted ||= Boolean(nextBuffer.replaceAll(ANSI_CONTROL, "").trim());
      nextBuffer = "";
    } else if (character === "\x7f" || character === "\b") {
      nextBuffer = nextBuffer.slice(0, -1);
    } else {
      nextBuffer = `${nextBuffer}${character}`.slice(-8_000);
    }
  }

  return { buffer: nextBuffer, submitted };
}

export function isMissingClaudeConversation(output: string): boolean {
  return MISSING_CONVERSATION.test(output.replaceAll(ANSI_CONTROL, ""));
}
