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

export default class BuiltSimplePlugin extends Plugin {
    settings: BuiltSimpleSettings;

    async onload() {
        await this.loadSettings();

        // Add ribbon icon for quick search
        this.addRibbonIcon('search', 'Built Simple Research', async () => {
            new SearchModal(this.app, this).open();
        });

        // Add command: Search selection
        this.addCommand({
            id: 'search-selection',
            name: 'Search selected text',
            editorCallback: async (editor: Editor, view: MarkdownView) => {
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
            name: 'Search PubMed',
            callback: () => {
                new SearchModal(this.app, this, '', 'pubmed').open();
            }
        });

        // Add command: ArXiv search
        this.addCommand({
            id: 'arxiv-search',
            name: 'Search ArXiv',
            callback: () => {
                new SearchModal(this.app, this, '', 'arxiv').open();
            }
        });

        // Add command: Wikipedia search
        this.addCommand({
            id: 'wikipedia-search',
            name: 'Search Wikipedia',
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
    results: any[] = [];

    constructor(app: App, plugin: BuiltSimplePlugin, query: string = '', source: string = 'all') {
        super(app);
        this.plugin = plugin;
        this.query = query;
        this.source = source;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'Built Simple Research' });

        // Search input
        const inputContainer = contentEl.createDiv({ cls: 'search-input-container' });
        const searchInput = inputContainer.createEl('input', {
            type: 'text',
            placeholder: 'Enter search query...',
            value: this.query
        });
        searchInput.style.width = '100%';
        searchInput.style.padding = '8px';
        searchInput.style.marginBottom = '10px';

        // Source selector
        const sourceContainer = contentEl.createDiv({ cls: 'source-selector' });
        const sourceSelect = sourceContainer.createEl('select');
        sourceSelect.style.marginBottom = '10px';
        
        const sources = [
            { value: 'all', label: 'All Sources' },
            { value: 'pubmed', label: 'PubMed' },
            { value: 'arxiv', label: 'ArXiv' },
            { value: 'wikipedia', label: 'Wikipedia' }
        ];
        
        sources.forEach(s => {
            const option = sourceSelect.createEl('option', { value: s.value, text: s.label });
            if (s.value === this.source) option.selected = true;
        });

        // Search button
        const searchBtn = contentEl.createEl('button', { text: 'Search' });
        searchBtn.style.marginRight = '10px';
        searchBtn.onclick = async () => {
            const query = searchInput.value;
            const source = sourceSelect.value;
            if (query) {
                await this.performSearch(query, source);
            }
        };

        // Results container
        const resultsContainer = contentEl.createDiv({ cls: 'results-container' });
        resultsContainer.id = 'search-results';

        // Auto-search if query provided
        if (this.query) {
            searchInput.value = this.query;
            this.performSearch(this.query, this.source);
        }
    }

    async performSearch(query: string, source: string) {
        const resultsEl = document.getElementById('search-results');
        if (!resultsEl) return;
        
        resultsEl.innerHTML = '<p>Searching...</p>';
        
        const results: any[] = [];
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

            this.displayResults(results, resultsEl);
        } catch (error) {
            resultsEl.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
        }
    }

    async searchPubMed(query: string, limit: number): Promise<any[]> {
        const response = await requestUrl({
            url: `https://pubmed.built-simple.ai/search?q=${encodeURIComponent(query)}&limit=${limit}`,
            method: 'GET'
        });
        return response.json.results || [];
    }

    async searchArxiv(query: string, limit: number): Promise<any[]> {
        const response = await requestUrl({
            url: `https://arxiv.built-simple.ai/search?q=${encodeURIComponent(query)}&limit=${limit}`,
            method: 'GET'
        });
        return response.json.results || [];
    }

    async searchWikipedia(query: string, limit: number): Promise<any[]> {
        const response = await requestUrl({
            url: `https://wikipedia.built-simple.ai/search?q=${encodeURIComponent(query)}&limit=${limit}`,
            method: 'GET'
        });
        return response.json.results || [];
    }

    displayResults(results: any[], container: HTMLElement) {
        container.innerHTML = '';
        
        if (results.length === 0) {
            container.createEl('p', { text: 'No results found.' });
            return;
        }

        results.forEach(result => {
            const resultDiv = container.createDiv({ cls: 'search-result' });
            resultDiv.style.padding = '10px';
            resultDiv.style.marginBottom = '10px';
            resultDiv.style.border = '1px solid var(--background-modifier-border)';
            resultDiv.style.borderRadius = '5px';
            
            // Source badge
            const badge = resultDiv.createEl('span', { text: result.source });
            badge.style.fontSize = '0.8em';
            badge.style.padding = '2px 6px';
            badge.style.borderRadius = '3px';
            badge.style.backgroundColor = 'var(--interactive-accent)';
            badge.style.color = 'var(--text-on-accent)';
            badge.style.marginRight = '8px';
            
            // Title
            const title = resultDiv.createEl('strong', { text: result.title || 'Untitled' });
            title.style.display = 'block';
            title.style.marginTop = '5px';
            
            // Abstract/snippet
            if (result.abstract || result.snippet || result.summary) {
                const snippet = resultDiv.createEl('p', { 
                    text: (result.abstract || result.snippet || result.summary).substring(0, 200) + '...' 
                });
                snippet.style.fontSize = '0.9em';
                snippet.style.color = 'var(--text-muted)';
            }
            
            // Insert button
            const insertBtn = resultDiv.createEl('button', { text: 'Insert Citation' });
            insertBtn.style.marginTop = '5px';
            insertBtn.onclick = () => {
                this.insertCitation(result);
            };
        });
    }

    insertCitation(result: any) {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
            const citation = this.formatCitation(result);
            view.editor.replaceSelection(citation);
            new Notice('Citation inserted!');
            this.close();
        }
    }

    formatCitation(result: any): string {
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

        containerEl.createEl('h2', { text: 'Built Simple Research Settings' });

        new Setting(containerEl)
            .setName('Enable PubMed')
            .setDesc('Search biomedical literature from PubMed')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.pubmedEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.pubmedEnabled = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Enable ArXiv')
            .setDesc('Search preprints from ArXiv')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.arxivEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.arxivEnabled = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Enable Wikipedia')
            .setDesc('Search Wikipedia articles')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.wikipediaEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.wikipediaEnabled = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Max Results')
            .setDesc('Maximum number of results per source')
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
