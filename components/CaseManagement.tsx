// components/CaseManagement.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { caseService, CaseItem, CreateCaseRequest, CaseFilters, CaseStats } from '../services/caseService';

interface CaseManagementProps {
  selectedCaseId?: string;
  onCaseSelect: (caseId: string) => void;
  onCaseCreate?: (newCase: CaseItem) => void;
  showCreateButton?: boolean;
  compact?: boolean;
  showStats?: boolean;
}

interface SortConfig {
  field: keyof CaseItem | 'metadata.totalScreenshots' | 'metadata.totalVideos';
  direction: 'asc' | 'desc';
}

export default function CaseManagement({
  selectedCaseId,
  onCaseSelect,
  onCaseCreate,
  showCreateButton = true,
  compact = false,
  showStats = true
}: CaseManagementProps) {
  // State management
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<CaseFilters>({});
  const [stats, setStats] = useState<CaseStats | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'createdAt', direction: 'desc' });
  const [selectedCases, setSelectedCases] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'table'>('list');
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  // Load data on mount and when filters change
  useEffect(() => {
    loadCases();
    if (showStats) loadStats();
    loadAvailableTags();
  }, [filters, searchQuery]);

  // Memoized filtered and sorted cases
  const processedCases = useMemo(() => {
    let filtered = [...cases];

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(case_ => 
        case_.title.toLowerCase().includes(query) ||
        case_.description?.toLowerCase().includes(query) ||
        case_.id.toLowerCase().includes(query) ||
        case_.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      if (sortConfig.field.includes('.')) {
        const [parent, child] = sortConfig.field.split('.');
        aValue = (a as any)[parent]?.[child] || 0;
        bValue = (b as any)[parent]?.[child] || 0;
      } else {
        aValue = a[sortConfig.field as keyof CaseItem];
        bValue = b[sortConfig.field as keyof CaseItem];
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [cases, searchQuery, sortConfig]);

  const loadCases = async () => {
    setLoading(true);
    setError(null);
    try {
      const filterParams = {
        ...filters,
        ...(searchQuery && { search: searchQuery })
      };
      const fetchedCases = await caseService.getCases(filterParams);
      setCases(fetchedCases);
    } catch (error) {
      console.error('Failed to load cases:', error);
      setError('Failed to load cases. Please try again.');
    }
    setLoading(false);
  };

  const loadStats = async () => {
    try {
      const caseStats = await caseService.getCaseStats();
      setStats(caseStats);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadAvailableTags = async () => {
    try {
      const tags = await caseService.getAvailableTags();
      setAvailableTags(tags);
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  };

  const handleCreateCase = async (caseData: CreateCaseRequest) => {
    try {
      const newCase = await caseService.createCase(caseData);
      setCases(prev => [newCase, ...prev]);
      setShowCreateModal(false);
      onCaseCreate?.(newCase);
      loadStats(); // Refresh stats
      loadAvailableTags(); // Refresh available tags
    } catch (error) {
      console.error('Failed to create case:', error);
      alert('Failed to create case. Please try again.');
    }
  };

  const handleUpdateCase = async (caseId: string, updates: Partial<CaseItem>) => {
    try {
      const updatedCase = await caseService.updateCase(caseId, updates);
      setCases(prev => prev.map(c => c.id === caseId ? updatedCase : c));
      loadStats();
    } catch (error) {
      console.error('Failed to update case:', error);
      alert('Failed to update case. Please try again.');
    }
  };

  const handleDeleteCase = async (caseId: string) => {
    if (!confirm('Are you sure you want to delete this case? This action cannot be undone.')) {
      return;
    }

    try {
      const success = await caseService.deleteCase(caseId);
      if (success) {
        setCases(prev => prev.filter(c => c.id !== caseId));
        if (selectedCaseId === caseId) {
          onCaseSelect('');
        }
        loadStats();
      } else {
        alert('Failed to delete case.');
      }
    } catch (error) {
      console.error('Failed to delete case:', error);
      alert('Failed to delete case. Please try again.');
    }
  };

  const handleBulkUpdate = async (updates: Partial<CaseItem>) => {
    const caseIds = Array.from(selectedCases);
    if (caseIds.length === 0) return;

    try {
      const success = await caseService.bulkUpdateCases(caseIds, updates);
      if (success) {
        await loadCases();
        setSelectedCases(new Set());
        setShowBulkActions(false);
        loadStats();
      } else {
        alert('Failed to update cases.');
      }
    } catch (error) {
      console.error('Failed to bulk update cases:', error);
      alert('Failed to update cases. Please try again.');
    }
  };

  const handleExportCases = async () => {
    try {
      const csvData = await caseService.exportCases(filters);
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cases-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export cases:', error);
      alert('Failed to export cases.');
    }
  };

  const handleStatusFilter = (status: string) => {
    setFilters(prev => {
      const currentStatus = prev.status || [];
      const newStatus = currentStatus.includes(status)
        ? currentStatus.filter(s => s !== status)
        : [...currentStatus, status];
      
      return { ...prev, status: newStatus.length > 0 ? newStatus : undefined };
    });
  };

  const handlePriorityFilter = (priority: string) => {
    setFilters(prev => {
      const currentPriority = prev.priority || [];
      const newPriority = currentPriority.includes(priority)
        ? currentPriority.filter(p => p !== priority)
        : [...currentPriority, priority];
      
      return { ...prev, priority: newPriority.length > 0 ? newPriority : undefined };
    });
  };

  const handleTagFilter = (tag: string) => {
    setFilters(prev => {
      const currentTags = prev.tags || [];
      const newTags = currentTags.includes(tag)
        ? currentTags.filter(t => t !== tag)
        : [...currentTags, tag];
      
      return { ...prev, tags: newTags.length > 0 ? newTags : undefined };
    });
  };

  const handleSort = (field: SortConfig['field']) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const clearFilters = () => {
    setFilters({});
    setSearchQuery('');
    setSelectedCases(new Set());
  };

  const toggleCaseSelection = (caseId: string) => {
    setSelectedCases(prev => {
      const newSet = new Set(prev);
      if (newSet.has(caseId)) {
        newSet.delete(caseId);
      } else {
        newSet.add(caseId);
      }
      return newSet;
    });
  };

  const selectAllCases = () => {
    setSelectedCases(new Set(processedCases.map(c => c.id)));
  };

  const deselectAllCases = () => {
    setSelectedCases(new Set());
  };

  // Utility functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'closed': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'archived': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-blue-600';
      case 'low': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  // Compact mode for sidebar
  if (compact) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">Select Case</h3>
          {showCreateButton && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded transition-colors"
            >
              + New
            </button>
          )}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search cases..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />

        {/* Case Dropdown */}
        <select
          value={selectedCaseId || ''}
          onChange={(e) => onCaseSelect(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Select a case...</option>
          {processedCases.map((case_) => (
            <option key={case_.id} value={case_.id}>
              {case_.id} - {case_.title}
            </option>
          ))}
        </select>

        {/* Selected Case Preview */}
        {selectedCaseId && processedCases.find(c => c.id === selectedCaseId) && (
          <div className="text-xs bg-blue-50 border border-blue-200 rounded p-3">
            {(() => {
              const selectedCase = processedCases.find(c => c.id === selectedCaseId)!;
              return (
                <>
                  <div className="font-medium text-blue-900 mb-1">{selectedCase.id}</div>
                  <div className="text-blue-800 mb-1">{selectedCase.title}</div>
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-1 rounded text-xs ${getStatusColor(selectedCase.status)}`}>
                      {selectedCase.status}
                    </span>
                    <span className={getPriorityColor(selectedCase.priority)}>
                      {getPriorityIcon(selectedCase.priority)}
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Quick Stats */}
        {stats && (
          <div className="text-xs bg-gray-50 rounded p-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="font-bold text-lg text-blue-600">{stats.total}</div>
                <div className="text-gray-600">Total Cases</div>
              </div>
              <div>
                <div className="font-bold text-lg text-green-600">{stats.active}</div>
                <div className="text-gray-600">Active</div>
              </div>
            </div>
          </div>
        )}

        {showCreateModal && (
          <CreateCaseModal
            onClose={() => setShowCreateModal(false)}
            onCreate={handleCreateCase}
            availableTags={availableTags}
          />
        )}
      </div>
    );
  }

  // Full mode
  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="border-b border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Case Management</h2>
          <div className="flex items-center space-x-2">
            {/* View Mode Toggle */}
            <div className="flex bg-gray-100 rounded-md p-1">
              {['list', 'grid', 'table'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode as any)}
                  className={`px-3 py-1 text-xs rounded ${
                    viewMode === mode
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 py-2 text-sm border rounded-md transition-colors ${
                showFilters
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Filters {Object.keys(filters).length > 0 && `(${Object.keys(filters).length})`}
            </button>

            <button
              onClick={handleExportCases}
              className="px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Export
            </button>

            {selectedCases.size > 0 && (
              <button
                onClick={() => setShowBulkActions(!showBulkActions)}
                className="px-3 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
              >
                Bulk Actions ({selectedCases.size})
              </button>
            )}

            {showCreateButton && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 text-sm bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors"
              >
                + New Case
              </button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search cases by title, description, ID, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <div className="space-y-2">
                  {['active', 'pending', 'closed', 'archived'].map(status => (
                    <label key={status} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.status?.includes(status) || false}
                        onChange={() => handleStatusFilter(status)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700 capitalize">{status}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Priority Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                <div className="space-y-2">
                  {['low', 'medium', 'high', 'critical'].map(priority => (
                    <label key={priority} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.priority?.includes(priority) || false}
                        onChange={() => handlePriorityFilter(priority)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700 capitalize">
                        {getPriorityIcon(priority)} {priority}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Tags Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {availableTags.map(tag => (
                    <label key={tag} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.tags?.includes(tag) || false}
                        onChange={() => handleTagFilter(tag)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">#{tag}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Clear all filters
              </button>
              <div className="text-sm text-gray-600">
                Showing {processedCases.length} of {cases.length} cases
              </div>
            </div>
          </div>
        )}

        {/* Bulk Actions */}
        {showBulkActions && selectedCases.size > 0 && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-blue-900">
                {selectedCases.size} case(s) selected
              </span>
              <div className="flex space-x-2">
                <select
                  onChange={(e) => e.target.value && handleBulkUpdate({ status: e.target.value as any })}
                  className="text-sm border border-blue-300 rounded px-2 py-1"
                  defaultValue=""
                >
                  <option value="">Change Status</option>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="closed">Closed</option>
                  <option value="archived">Archived</option>
                </select>
                <select
                  onChange={(e) => e.target.value && handleBulkUpdate({ priority: e.target.value as any })}
                  className="text-sm border border-blue-300 rounded px-2 py-1"
                  defaultValue=""
                >
                  <option value="">Change Priority</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
                <button
                  onClick={deselectAllCases}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Deselect All
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Statistics */}
      {showStats && stats && (
        <div className="border-b border-gray-200 p-6">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-sm text-gray-500">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.active}</div>
              <div className="text-sm text-gray-500">Active</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <div className="text-sm text-gray-500">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">{stats.closed}</div>
              <div className="text-sm text-gray-500">Closed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.totalFiles}</div>
              <div className="text-sm text-gray-500">Files</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{formatFileSize(stats.totalFileSize)}</div>
              <div className="text-sm text-gray-500">Storage</div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-gray-600">Loading cases...</span>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-red-500 text-lg mb-2">Error</div>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={loadCases}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Retry
            </button>
          </div>
        ) : processedCases.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📁</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No cases found</h3>
            <p className="text-gray-500 mb-4">
              {searchQuery || Object.keys(filters).length > 0
                ? 'Try adjusting your search or filters'
                : 'Get started by creating your first case'
              }
            </p>
            {(searchQuery || Object.keys(filters).length > 0) && (
              <button
                onClick={clearFilters}
                className="text-blue-600 hover:text-blue-800 mr-4"
              >
                Clear filters
              </button>
            )}
            {showCreateButton && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                Create Case
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table Header with Sorting */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedCases.size === processedCases.length && processedCases.length > 0}
                    onChange={(e) => e.target.checked ? selectAllCases() : deselectAllCases()}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Select All</span>
                </label>
                <div className="text-sm text-gray-500">
                  {selectedCases.size > 0 && `${selectedCases.size} selected`}
                </div>
              </div>

              <div className="flex items-center space-x-2 text-sm">
                <span className="text-gray-500">Sort by:</span>
                <select
                  value={`${sortConfig.field}-${sortConfig.direction}`}
                  onChange={(e) => {
                    const [field, direction] = e.target.value.split('-');
                    setSortConfig({ field: field as SortConfig['field'], direction: direction as 'asc' | 'desc' });
                  }}
                  className="border border-gray-300 rounded px-2 py-1"
                >
                  <option value="createdAt-desc">Newest First</option>
                  <option value="createdAt-asc">Oldest First</option>
                  <option value="title-asc">Title A-Z</option>
                  <option value="title-desc">Title Z-A</option>
                  <option value="priority-desc">Priority High-Low</option>
                  <option value="priority-asc">Priority Low-High</option>
                  <option value="status-asc">Status</option>
                  <option value="metadata.totalScreenshots-desc">Most Screenshots</option>
                </select>
              </div>
            </div>

            {/* Cases List */}
            <div className="space-y-4">
              {processedCases.map((case_) => (
                <CaseCard
                  key={case_.id}
                  case_={case_}
                  isSelected={selectedCases.has(case_.id)}
                  onSelect={() => toggleCaseSelection(case_.id)}
                  onCaseSelect={onCaseSelect}
                  onUpdate={handleUpdateCase}
                  onDelete={handleDeleteCase}
                  selectedCaseId={selectedCaseId}
                  getStatusColor={getStatusColor}
                  getPriorityColor={getPriorityColor}
                  getPriorityIcon={getPriorityIcon}
                  formatDate={formatDate}
                  formatFileSize={formatFileSize}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Create Case Modal */}
      {showCreateModal && (
        <CreateCaseModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateCase}
          availableTags={availableTags}
        />
      )}
    </div>
  );
}

// Case Card Component
interface CaseCardProps {
  case_: CaseItem;
  isSelected: boolean;
  onSelect: () => void;
  onCaseSelect: (caseId: string) => void;
  onUpdate: (caseId: string, updates: Partial<CaseItem>) => void;
  onDelete: (caseId: string) => void;
  selectedCaseId?: string;
  getStatusColor: (status: string) => string;
  getPriorityColor: (priority: string) => string;
  getPriorityIcon: (priority: string) => string;
  formatDate: (date: string) => string;
  formatFileSize: (bytes: number) => string;
}

function CaseCard({
  case_,
  isSelected,
  onSelect,
  onCaseSelect,
  onUpdate,
  onDelete,
  selectedCaseId,
  getStatusColor,
  getPriorityColor,
  getPriorityIcon,
  formatDate,
  formatFileSize
}: CaseCardProps) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className={`border rounded-lg p-4 transition-all duration-200 ${
        selectedCaseId === case_.id
          ? 'border-blue-500 bg-blue-50 shadow-md'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start space-x-4">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <button
                  onClick={() => onCaseSelect(case_.id)}
                  className="font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                >
                  {case_.id}
                </button>
                <span className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(case_.status)}`}>
                  {case_.status}
                </span>
                <span className={`text-sm font-medium ${getPriorityColor(case_.priority)}`}>
                  {getPriorityIcon(case_.priority)} {case_.priority}
                </span>
              </div>

              <h3 className="text-lg font-medium text-gray-900 mb-1">{case_.title}</h3>
              
              {case_.description && (
                <p className="text-gray-600 text-sm mb-3 line-clamp-2">{case_.description}</p>
              )}

              <div className="flex items-center space-x-6 text-sm text-gray-500 mb-3">
                <span>Created {formatDate(case_.createdAt)}</span>
                {case_.updatedAt && (
                  <span>Updated {formatDate(case_.updatedAt)}</span>
                )}
                {case_.assignedTo && (
                  <span>Assigned to {case_.assignedTo}</span>
                )}
              </div>

              {case_.metadata && (
                <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                  {case_.metadata.totalScreenshots && (
                    <span className="flex items-center">
                      <span className="mr-1">📷</span>
                      {case_.metadata.totalScreenshots} screenshots
                    </span>
                  )}
                  {case_.metadata.totalVideos && (
                    <span className="flex items-center">
                      <span className="mr-1">🎥</span>
                      {case_.metadata.totalVideos} videos
                    </span>
                  )}
                  {case_.metadata.totalFileSize && (
                    <span className="flex items-center">
                      <span className="mr-1">💾</span>
                      {formatFileSize(case_.metadata.totalFileSize)}
                    </span>
                  )}
                </div>
              )}

              {case_.tags && case_.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {case_.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 cursor-pointer"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="relative">
              <button
                onClick={() => setShowActions(!showActions)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>

              {showActions && (
                <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                  <button
                    onClick={() => {
                      onCaseSelect(case_.id);
                      setShowActions(false);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Select Case
                  </button>
                  <button
                    onClick={() => {
                      // Open edit modal (would need to implement)
                      setShowActions(false);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Edit Case
                  </button>
                  <button
                    onClick={() => {
                      onDelete(case_.id);
                      setShowActions(false);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                  >
                    Delete Case
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Create Case Modal Component
interface CreateCaseModalProps {
  onClose: () => void;
  onCreate: (caseData: CreateCaseRequest) => void;
  availableTags: string[];
}

function CreateCaseModal({ onClose, onCreate, availableTags }: CreateCaseModalProps) {
  const [formData, setFormData] = useState<CreateCaseRequest>({
    title: '',
    description: '',
    priority: 'medium',
    tags: []
  });
  const [tagInput, setTagInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await onCreate(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags?.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags?.filter(tag => tag !== tagToRemove)
    }));
  };

  const addExistingTag = (tag: string) => {
    if (!formData.tags?.includes(tag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), tag]
      }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Create New Case</h3>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter case title"
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter case description"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priority
            </label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as any }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isSubmitting}
            >
              <option value="low">🟢 Low</option>
              <option value="medium">🟡 Medium</option>
              <option value="high">🟠 High</option>
              <option value="critical">🔴 Critical</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tags
            </label>
            <div className="space-y-3">
              {/* Add new tag */}
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Add new tag"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={addTag}
                  disabled={!tagInput.trim() || isSubmitting}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50"
                >
                  Add
                </button>
              </div>

              {/* Existing tags */}
              {availableTags.length > 0 && (
                <div>
                  <div className="text-xs text-gray-600 mb-2">Or choose from existing tags:</div>
                  <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                    {availableTags.filter(tag => !formData.tags?.includes(tag)).map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => addExistingTag(tag)}
                        className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                        disabled={isSubmitting}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected tags */}
              {formData.tags && formData.tags.length > 0 && (
                <div>
                  <div className="text-xs text-gray-600 mb-2">Selected tags:</div>
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center space-x-1"
                      >
                        <span>#{tag}</span>
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="text-blue-500 hover:text-blue-700 ml-1"
                          disabled={isSubmitting}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!formData.title.trim() || isSubmitting}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Creating...
                </>
              ) : (
                'Create Case'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}