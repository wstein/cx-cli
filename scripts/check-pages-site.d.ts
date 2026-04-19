export interface CheckPagesSiteOptions {
  siteRoot?: string;
}

export interface CheckPagesSiteResult {
  siteRoot: string;
  hasCoverage: boolean;
}

export declare function checkPagesSite(
  options?: CheckPagesSiteOptions,
): Promise<CheckPagesSiteResult>;
