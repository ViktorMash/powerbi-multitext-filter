"use strict";

import powerbi from "powerbi-visuals-api";
import "./../style/visual.less"
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ISelectionId = powerbi.visuals.ISelectionId;

interface TextSlicerDataPoint {
    value: string;
    tableName: string;
    columnName: string;
    selectionId: ISelectionId;
}

interface FieldMatch {
    tableName: string;
    columnName: string;
    count: number;
    uniqueValues: Set<string>; // Track unique values to avoid duplicates
}

export class Visual implements IVisual {
    private host: IVisualHost;
    private selectionManager: ISelectionManager;
    private container: HTMLElement;
    private textInput: HTMLInputElement;
    private filterButton: HTMLButtonElement;
    private clearButton: HTMLButtonElement;
    private targetColumns: powerbi.DataViewMetadataColumn[] = [];
    private dataPoints: TextSlicerDataPoint[] = [];
    private resultsContainer: HTMLElement;
    
    constructor(options: VisualConstructorOptions) {
        /*
            Create HTML elements (container, input field, buttons, result container)
            Add event handlers for buttons and input field
        */
        this.host = options.host;
        this.selectionManager = options.host.createSelectionManager();
        
        // Create container
        this.container = document.createElement("div");
        this.container.className = "text-slicer-container";
        options.element.appendChild(this.container);
        
        // Create search container for input and buttons
        const searchContainer = document.createElement("div");
        searchContainer.className = "search-container";
        this.container.appendChild(searchContainer);

        // Create text input field
        this.textInput = document.createElement("input");
        this.textInput.type = "text";
        this.textInput.className = "slicer-text-input";
        this.textInput.placeholder = "Search";
        searchContainer.appendChild(this.textInput);

        // === Create apply filter button ===
        this.filterButton = document.createElement("button");
        this.filterButton.className = "slicer-filter-button";

        // Create apply filter SVG element
        const svgApplyFilter = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgApplyFilter.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        svgApplyFilter.setAttribute("viewBox", "0 0 24 24");
        svgApplyFilter.setAttribute("width", "16");
        svgApplyFilter.setAttribute("height", "16");

        // Create path element
        const pathApplyFilter = document.createElementNS("http://www.w3.org/2000/svg", "path");
        pathApplyFilter.setAttribute("d", "M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z");
        
        svgApplyFilter.appendChild(pathApplyFilter); // Add path to SVG
        this.filterButton.appendChild(svgApplyFilter); // Add SVG to the button
        searchContainer.appendChild(this.filterButton);

        // === Create clear filter button ===
        this.clearButton = document.createElement("button");
        this.clearButton.className = "slicer-clear-button";

        // Create clear filter SVG element
        const svgClearFilter = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgClearFilter.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        svgClearFilter.setAttribute("viewBox", "0 0 24 24");
        svgClearFilter.setAttribute("width", "16");
        svgClearFilter.setAttribute("height", "16");

        // Create path element
        const pathClearFilter = document.createElementNS("http://www.w3.org/2000/svg", "path");
        pathClearFilter.setAttribute("d", "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z");
        
        svgClearFilter.appendChild(pathClearFilter); // Add path to SVG
        this.clearButton.appendChild(svgClearFilter); // Add SVG to the button
        searchContainer.appendChild(this.clearButton);

        // === Create results container ===
        this.resultsContainer = document.createElement("div");
        this.resultsContainer.className = "results-container";
        this.container.appendChild(this.resultsContainer);
        
        // Add event handlers
        this.filterButton.addEventListener("click", () => {
            this.applyFilter();
        });
        
        this.clearButton.addEventListener("click", () => {
            this.textInput.value = "";
            this.clearFilter();
        });
        
        this.textInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                this.applyFilter();
            }
        });
    }
    
  
    private applyFilter() {
        /*
            Get text from the input field
            Split into separate values ​​by commas
            If there are values ​​to search for and target columns, apply a filter via applyMultiFieldFilter
        */
        const filterText = this.textInput.value.trim();
        
        // Clear results
        this.clearResults();
        
        // If the field is empty, reset the filter
        if (!filterText) {
            this.clearFilter();
            return;
        }
        
        // Split the entered text into values by comma
        const filterValues = filterText.split(',')
            .map(value => value.trim())
            .filter(value => value.length > 0);
        
        if (filterValues.length === 0) {
            this.clearFilter();
            return;
        }
        
        // Apply filter only if there are target columns
        if (this.targetColumns.length > 0) {
            // Create selection for each value and apply filter
            this.applyMultiFieldFilter(filterValues);
        } else {
            // Show message about missing columns for filtering
            this.showErrorMessage("No fields selected for filtering");
        }
    }
    
    private applyMultiFieldFilter(filterValues: string[]) {
        /*
            Main search function

            If there are matches:
              - Group the found fields by table and column
              - Collect all selectionId for matching values
              - Apply the selection via selectionManager.select()
              - Display information about matches in the interface

            If there are no matches:
              - display a message and apply an empty selection
        */

        if (this.targetColumns.length === 0 || this.dataPoints.length === 0) {
            return;
        }    
        
        // Create data structure to store matches for each term
        const termMatches = new Map<string, Map<string, FieldMatch>>();

        // For each search term, find matches
        filterValues.forEach(term => {
            // Find data points matching this term
            const matchesForTerm = this.dataPoints.filter(dataPoint => 
                dataPoint.value.toLowerCase().includes(term.toLowerCase())
            );
            
            // Create or get the match map for this term
            if (!termMatches.has(term)) {
                termMatches.set(term, new Map());
            }
            
            // Count matches by field for this term
            matchesForTerm.forEach(point => {
                const key = `${point.tableName}.${point.columnName}`;
                const fieldMap = termMatches.get(term);
                
                // Count actual occurrences of the term in this value
                const lowerCaseValue = point.value.toLowerCase();
                const lowerCaseTerm = term.toLowerCase();
                let termCount = 0;
                let pos = 0;
                
                // Count all occurrences of the term in this value
                while ((pos = lowerCaseValue.indexOf(lowerCaseTerm, pos)) !== -1) {
                    termCount++;
                    pos += lowerCaseTerm.length;
                }
                
                if (!fieldMap.has(key)) {
                    // First time seeing this field, initialize with current value
                    fieldMap.set(key, {
                        tableName: point.tableName,
                        columnName: point.columnName,
                        count: termCount,
                        uniqueValues: new Set([point.value])
                    });
                } else {
                    const entry = fieldMap.get(key);
                    // Only count if this is a new unique value we haven't seen before
                    if (!entry.uniqueValues.has(point.value)) {
                        entry.count += termCount;
                        entry.uniqueValues.add(point.value);
                    }
                }
            });
        });
        
        // Collect all matching data points for selection
        const allMatchingPoints = this.dataPoints.filter(dataPoint => 
            filterValues.some(filterValue => 
                dataPoint.value.toLowerCase().includes(filterValue.toLowerCase())
            )
        );
        
        // If we have matches, apply the filter
        if (allMatchingPoints.length > 0) {
            // Collect all selection IDs
            const selectionIds = allMatchingPoints.map(p => p.selectionId);
            
            // Apply selection through Selection API
            this.selectionManager.select(selectionIds, false)
                .then(() => {
                    // Display which fields matched (grouped by term, then by table)
                    this.displayMatchedFieldsByTerm(termMatches, filterValues);
                    console.log("Filter applied with matches for", termMatches.size, "terms");
                })
                .catch(error => {
                    console.error("Error applying filter:", error);
                });
        } else {
            // If no matches, show empty result and apply empty selection
            this.applyEmptySelection();
            this.showNoResults(filterValues);
        }
    }

    private displayMatchedFieldsByTerm(
        termMatches: Map<string, Map<string, {tableName: string, columnName: string, count: number}>>, 
        filterValues: string[]
    ) {
        /*
            Displays search results in UI:
            
            - Clears previous results
            - Shows search term information
            - For each search term with matches:
                - Creates a section with term title
                - Groups matches by table
                - For each table, displays:
                    * Table name
                    * List of fields with match counts
        */
        
        // Clear previous results
        this.clearResults();
        
        // Create a message for the search terms
        const messageElem = document.createElement("div");
        messageElem.className = "status-message";
        const termText = filterValues.length > 1 ? "terms" : "term";
        messageElem.textContent = `Searching ${termText}: ${filterValues.join(", ")}`;
        this.resultsContainer.appendChild(messageElem);
        
        // For each term create a results block
        filterValues.forEach(term => {
            const fieldMap = termMatches.get(term);
            
            // Skip terms without matches
            if (!fieldMap || fieldMap.size === 0) {
                return;
            }
            
            // Create container for matches for this term
            const termResultsElem = document.createElement("div");
            termResultsElem.className = "matched-fields";
            
            // Title for the term
            const titleElem = document.createElement("div");
            titleElem.className = "term-title";
            titleElem.textContent = `"${term}" found in:`;
            termResultsElem.appendChild(titleElem);
            
            // Group fields by table
            const tableFieldsMap = new Map<string, {field: string, count: number}[]>();
            
            fieldMap.forEach((info, key) => {
                if (!tableFieldsMap.has(info.tableName)) {
                    tableFieldsMap.set(info.tableName, []);
                }
                tableFieldsMap.get(info.tableName).push({
                    field: info.columnName,
                    count: info.count
                });
            });
            
            // Sort tables
            const tables = Array.from(tableFieldsMap.keys()).sort();
            
            // Add each table and its fields
            tables.forEach(tableName => {
                const fields = tableFieldsMap.get(tableName).sort((a, b) => a.field.localeCompare(b.field));
                
                // Create container for found tables and columns
                const tableEntry = document.createElement("div");
                tableEntry.className = "field-entry";
                
                // Add table name
                const tableNameElem = document.createElement("div");
                tableNameElem.className = "table-name";
                tableNameElem.textContent = tableName;
                tableEntry.appendChild(tableNameElem);
                
                // Add each field within this table
                fields.forEach(fieldInfo => {
                    const fieldElem = document.createElement("div");
                    fieldElem.className = "column-name";
                    fieldElem.textContent = `${fieldInfo.field} (${fieldInfo.count} match${fieldInfo.count !== 1 ? 'es' : ''})`;
                    tableEntry.appendChild(fieldElem);
                });
                
                termResultsElem.appendChild(tableEntry);
            });
            
            this.resultsContainer.appendChild(termResultsElem);
        });
    }
    
    private showNoResults(filterValues: string[]) {
        // Clear previous results
        this.clearResults();
        
        // Create a message for no results
        const messageElem = document.createElement("div");
        messageElem.className = "no-matches";
        messageElem.textContent = `No matches found for: ${filterValues.join(", ")}`;
        this.resultsContainer.appendChild(messageElem);
    }
    
    private clearResults() {
        while (this.resultsContainer.firstChild) {
            this.resultsContainer.removeChild(this.resultsContainer.firstChild);
        }
    }
    
    private applyEmptySelection() {
        // Create a non-matching selection to force empty visualizations
        const dummySelectionId = this.host.createSelectionIdBuilder()
            .createSelectionId();
            
        this.selectionManager.select(dummySelectionId, false)
            .then(() => {
                console.log("Empty selection applied");
            })
            .catch(error => {
                console.error("Error applying empty selection:", error);
            });
    }
    
    private clearFilter() {
        // Clear selection through Selection API
        this.selectionManager.clear()
            .then(() => {
                // Selection successfully cleared
                this.clearResults();
                const messageElem = document.createElement("div");
                messageElem.className = "status-message";
                messageElem.textContent = "Filter has been cleared";
                this.resultsContainer.appendChild(messageElem);
            })
            .catch(error => {
                console.error("Error clearing filter:", error);
            });
    }
    
    private showErrorMessage(text: string) {
        // Clear previous results
        this.clearResults();
        
        // Create error message
        const message = document.createElement("div");
        message.className = "error-message";
        message.textContent = text;
        
        this.resultsContainer.appendChild(message);
    }
    
    public update(options: VisualUpdateOptions) {
        /*
            Get data from Power BI
            Save target columns for search
            For each category (field) create dataPoints with:
              - value
              - table name
              - column name
              - selectionId for selection API
        */

        if (!options || !options.dataViews || !options.dataViews[0]) {
            return;
        }
        
        const dataView = options.dataViews[0];
        
        // Check if we have categorical data and categories
        if (dataView.categorical && dataView.categorical.categories && dataView.categorical.categories.length > 0) {
            const categories = dataView.categorical.categories;
            
            // Store all target columns
            this.targetColumns = categories.map(category => category.source);
            
            // Clear previous dataPoints
            this.dataPoints = [];
            
            // Process each category (field)
            categories.forEach(category => {
                // Get the column name and table name for this category
                const columnName = category.source.displayName;
                const tableName = this.getTableName(category.source);
                
                // Process values for this category
                category.values.forEach((value, index) => {
                    const strValue = String(value);
                    
                    // Create selection ID for this specific value in this specific category
                    const selectionId = this.host.createSelectionIdBuilder()
                        .withCategory(category, index)
                        .createSelectionId();
                    
                    // Add to our dataPoints collection
                    this.dataPoints.push({
                        value: strValue,
                        tableName: tableName,
                        columnName: columnName,
                        selectionId: selectionId
                    });
                });
            });
        }
    }
    
    // Helper to extract table name from column metadata
    private getTableName(column: powerbi.DataViewMetadataColumn): string {
        if (!column) return "Unknown";
        
        // Try to get table name from queryName (format: 'TableName.ColumnName')
        if (column.queryName && column.queryName.indexOf('.') > 0) {
            return column.queryName.split('.')[0];
        }
        
        // If we can't determine table name, use a default
        return "Data";
    }
    
    public destroy(): void {
        // Clean up event handlers
        this.filterButton.removeEventListener("click", this.applyFilter);
        this.clearButton.removeEventListener("click", () => {
            this.textInput.value = "";
            this.clearFilter();
        });
        this.textInput.removeEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                this.applyFilter();
            }
        });
    }
}