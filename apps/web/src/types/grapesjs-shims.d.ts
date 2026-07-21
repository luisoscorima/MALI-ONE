declare module 'grapesjs/locale/es' {
  const messages: Record<string, unknown>;
  export default messages;
}

declare module 'grapesjs-preset-newsletter' {
  import type { Plugin } from 'grapesjs';

  type NewsletterPluginOptions = {
    modalTitleImport?: string;
    modalTitleExport?: string;
    modalLabelImport?: string;
    modalLabelExport?: string;
    importPlaceholder?: string;
    cellStyle?: Record<string, string>;
    blocks?: string[];
  };

  const plugin: Plugin<NewsletterPluginOptions>;
  export default plugin;
}
