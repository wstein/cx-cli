import { countTokens, countTokensForFiles } from "./tokens.js";

export interface TokenizerProvider {
  countTokens(text: string, encoding: string): number;
  countTokensForFiles(
    paths: string[],
    encoding: string,
  ): Promise<Map<string, number>>;
}

export const defaultTokenizerProvider: TokenizerProvider = {
  countTokens,
  countTokensForFiles,
};
