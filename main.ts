import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, requestUrl } from 'obsidian';

interface BuiltSimpleSettings {
    pubmedEnabled: boolean;
    arxivEnabled: boolean;
    wikipediaEnabled: boolean;
    maxResults: number;
}

const DEFAULT_SETTINGS: BuiltSimpleSettings = {
    pubmedEnabled: true,
    arxivEnabled: true,
    wikipediaEnabled: true,
    maxResults: 5
}

interface SearchResult {
    title?: string;
    abstract?: string;
    snippet?: string;
    summary?: string;
    authors?: string[];
    year?: string;
    date?: string;
    url?: string;
    link?: string;
    source?: string;
}

export default class BuiltSimplePlugin extends Plugin {
    settings: BuiltSimpleSettings;

    async onload() {
        await this.loadSettings();

        // Add ribbon icon for quick search
        this.addRibbonIcon('search', 'Search research databases', () => {
            new SearchModal(this.app, this).open();
        });

        // Add command: Search selection
        this.addCommand({
            id: 'search-selection',
            name: 'Search selected text',
            editorCallback: (editor: Editor, view: MarkdownView) => {
                const selection = editor.getSelection();
                if (selection) {
                    new SearchModal(this.app, this, selection).open();
                } else {
                    new Notice('Please select some text first');
                }
            }
        });

        // Add command: PubMed search
        this.addCommand({
            id: 'pubmed-search',
            name: 'Search biomedical literature',
            callback: () => {
                new SearchModal(this.app, this, '', 'pubmed').open();
            }
        });

        // Add command: ArXiv search
        this.addCommand({
            id: 'arxiv-search',
            name: 'Search preprints',
            callback: () => {
                new SearchModal(this.app, this, '', 'arxiv').open();
            }
        });

        // Add command: Wikipedia search
        this.addCommand({
            id: 'wikipedia-search',
            name: 'Search encyclopedia',
            callback: () => {
                new SearchModal(this.app, this, '', 'wikipedia').open();
            }
        });

        // Add settings tab
        this.addSettingTab(new BuiltSimpleSettingTab(this.app, this));
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class SearchModal extends Modal {
    plugin: BuiltSimplePlugin;
    query: string;
    source: string;
    resultsContainer: HTMLElement | null = null;

    constructor(app: App, plugin: BuiltSimplePlugin, query: string = '', source: string = 'all') {
        super(app);
        this.plugin = plugin;
        this.query = query;
        this.source = source;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('builtsimple-modal');
        contentEl.createEl('h2', { text: 'Search research databases' });

        // Search input
        const inputContainer = contentEl.createDiv({ cls: 'builtsimple-input-container' });
        const searchInput = inputContainer.createEl('input', {
            type: 'text',
            placeholder: 'Enter search query...',
            value: this.query,
            cls: 'builtsimple-search-input'
        });

        // Source selector
        const sourceContainer = contentEl.createDiv({ cls: 'builtsimple-source-selector' });
        const sourceSelect = sourceContainer.createEl('select', { cls: 'builtsimple-source-select' });

        const sources = [
            { value: 'all', label: 'All sources' },
            { value: 'pubmed', label: 'PubMed' },
            { value: 'arxiv', label: 'ArXiv' },
            { value: 'wikipedia', label: 'Wikipedia' }
        ];

        sources.forEach(s => {
            const option = sourceSelect.createEl('option', { value: s.value, text: s.label });
            if (s.value === this.source) option.selected = true;
        });

        // Search button
        const searchBtn = contentEl.createEl('button', { text: 'Search', cls: 'builtsimple-search-btn' });
        searchBtn.onclick = () => {
            const query = searchInput.value;
            const source = sourceSelect.value;
            if (query) {
                void this.performSearch(query, source);
            }
        };

        // Results container
        this.resultsContainer = contentEl.createDiv({ cls: 'builtsimple-results-container' });

        // Auto-search if query provided
        if (this.query) {
            searchInput.value = this.query;
            void this.performSearch(this.query, this.source);
        }
    }

    async performSearch(query: string, source: string) {
        if (!this.resultsContainer) return;

        this.resultsContainer.empty();
        this.resultsContainer.createEl('p', { text: 'Searching...' });

        const results: SearchResult[] = [];
        const limit = this.plugin.settings.maxResults;

        try {
            if (source === 'all' || source === 'pubmed') {
                if (this.plugin.settings.pubmedEnabled) {
                    const pubmedResults = await this.searchPubMed(query, limit);
                    results.push(...pubmedResults.map(r => ({ ...r, source: 'PubMed' })));
                }
            }

            if (source === 'all' || source === 'arxiv') {
                if (this.plugin.settings.arxivEnabled) {
                    const arxivResults = await this.searchArxiv(query, limit);
                    results.push(...arxivResults.map(r => ({ ...r, source: 'ArXiv' })));
                }
            }

            if (source === 'all' || source === 'wikipedia') {
                if (this.plugin.settings.wikipediaEnabled) {
                    const wikiResults = await this.searchWikipedia(query, limit);
                    results.push(...wikiResults.map(r => ({ ...r, source: 'Wikipedia' })));
                }
            }

            this.displayResults(results, this.resultsContainer);
        } catch (error) {
            this.resultsContainer.empty();
            const errorEl = this.resultsContainer.createEl('p', { cls: 'builtsimple-error' });
            errorEl.setText(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async searchPubMed(query: string, limit: number): Promise<SearchResult[]> {
        const response = await requestUrl({
            url: `https://pubmed.built-simple.ai/search?q=${encodeURIComponent(query)}&limit=${limit}`,
            method: 'GET'
        });
        return response.json.results || [];
    }

    async searchArxiv(query: string, limit: number): Promise<SearchResult[]> {
        const response = await requestUrl({
            url: `https://arxiv.built-simple.ai/search?q=${encodeURIComponent(query)}&limit=${limit}`,
            method: 'GET'
        });
        return response.json.results || [];
    }

    async searchWikipedia(query: string, limit: number): Promise<SearchResult[]> {
        const response = await requestUrl({
            url: `https://wikipedia.built-simple.ai/search?q=${encodeURIComponent(query)}&limit=${limit}`,
            method: 'GET'
        });
        return response.json.results || [];
    }

    displayResults(results: SearchResult[], container: HTMLElement) {
        container.empty();

        if (results.length === 0) {
            container.createEl('p', { text: 'No results found.' });
            return;
        }

        results.forEach(result => {
            const resultDiv = container.createDiv({ cls: 'builtsimple-result' });

            // Source badge
            resultDiv.createEl('span', {
                text: result.source || 'Unknown',
                cls: 'builtsimple-badge'
            });

            // Title
            resultDiv.createEl('strong', {
                text: result.title || 'Untitled',
                cls: 'builtsimple-title'
            });

            // Abstract/snippet
            if (result.abstract || result.snippet || result.summary) {
                const snippetText = (result.abstract || result.snippet || result.summary || '').substring(0, 200) + '...';
                resultDiv.createEl('p', {
                    text: snippetText,
                    cls: 'builtsimple-snippet'
                });
            }

            // Insert button
            const insertBtn = resultDiv.createEl('button', {
                text: 'Insert citation',
                cls: 'builtsimple-insert-btn'
            });
            insertBtn.onclick = () => {
                this.insertCitation(result);
            };
        });
    }

    insertCitation(result: SearchResult) {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
            const citation = this.formatCitation(result);
            view.editor.replaceSelection(citation);
            new Notice('Citation inserted!');
            this.close();
        }
    }

    formatCitation(result: SearchResult): string {
        const title = result.title || 'Untitled';
        const authors = result.authors?.join(', ') || 'Unknown';
        const year = result.year || result.date?.substring(0, 4) || '';
        const url = result.url || result.link || '';
        const source = result.source;

        if (source === 'PubMed') {
            return `> **${title}**\n> ${authors} (${year})\n> [PubMed](${url})\n\n`;
        } else if (source === 'ArXiv') {
            return `> **${title}**\n> ${authors} (${year})\n> [ArXiv](${url})\n\n`;
        } else {
            return `> **${title}**\n> [Wikipedia](${url})\n\n`;
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class BuiltSimpleSettingTab extends PluginSettingTab {
    plugin: BuiltSimplePlugin;

    constructor(app: App, plugin: BuiltSimplePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('Data sources')
            .setHeading();

        new Setting(containerEl)
            .setName('Pubmed')
            .setDesc('Search biomedical literature.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.pubmedEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.pubmedEnabled = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Arxiv')
            .setDesc('Search preprints.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.arxivEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.arxivEnabled = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Wikipedia')
            .setDesc('Search encyclopedia articles.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.wikipediaEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.wikipediaEnabled = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Results per source')
            .setDesc('Maximum number of results to show from each source.')
            .addSlider(slider => slider
                .setLimits(1, 20, 1)
                .setValue(this.plugin.settings.maxResults)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.maxResults = value;
                    await this.plugin.saveSettings();
                }));
    }
}
