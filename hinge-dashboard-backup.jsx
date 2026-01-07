import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

/**
 * Hinge Health Content Dashboard
 *
 * An interactive React dashboard for visualizing and analyzing
 * competitor content from HingeHealth.com
 *
 * Features:
 * - Sortable, filterable table of all content
 * - Visual charts and analytics
 * - NEW badges for recent content
 * - Export to CSV functionality
 * - Real-time filtering and search
 */

const HingeDashboard = () => {
  // State management
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterAudience, setFilterAudience] = useState('all');
  const [filterDateRange, setFilterDateRange] = useState('all');
  const [filterTopic, setFilterTopic] = useState('all');

  // Sort state
  const [sortField, setSortField] = useState('publishDate');
  const [sortDirection, setSortDirection] = useState('desc');

  // View state
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'cards'

  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658'];

  /**
   * Load data from JSON file
   */
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // In a real app, this would fetch from an API or read the file
        // For this example, we'll load from the public folder
        const response = await fetch('./hinge-content.json');

        if (!response.ok) {
          throw new Error('Could not load data. Please run the monitor script first.');
        }

        const jsonData = await response.json();
        setData(jsonData);
        setError(null);
      } catch (err) {
        setError(err.message);
        // For demo purposes, use sample data if file not found
        setSampleData();
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  /**
   * Set sample data for demo purposes
   */
  const setSampleData = () => {
    setData({
      lastUpdated: new Date().toISOString(),
      totalContent: 0,
      content: [],
      summary: {
        newContentCount: 0,
        contentByType: {},
        contentByAudience: {},
        topCategories: {}
      }
    });
  };

  /**
   * Get unique values for filters
   */
  const filterOptions = useMemo(() => {
    if (!data || !data.content) return { types: [], audiences: [], topics: [] };

    const types = [...new Set(data.content.map(item => item.contentType))].sort();
    const audiences = [...new Set(data.content.flatMap(item => item.targetAudience))].sort();
    const topics = [...new Set(data.content.flatMap(item => item.categories))].sort();

    return { types, audiences, topics };
  }, [data]);

  /**
   * Filter and sort content
   */
  const filteredContent = useMemo(() => {
    if (!data || !data.content) return [];

    let filtered = [...data.content];

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(search) ||
        item.metaDescription.toLowerCase().includes(search) ||
        item.categories.some(cat => cat.toLowerCase().includes(search))
      );
    }

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(item => item.contentType === filterType);
    }

    // Apply audience filter
    if (filterAudience !== 'all') {
      filtered = filtered.filter(item => item.targetAudience.includes(filterAudience));
    }

    // Apply topic filter
    if (filterTopic !== 'all') {
      filtered = filtered.filter(item => item.categories.includes(filterTopic));
    }

    // Apply date range filter
    if (filterDateRange !== 'all') {
      const now = new Date();
      const ranges = {
        '7days': 7,
        '30days': 30,
        '90days': 90,
        '180days': 180,
        '365days': 365
      };

      const daysAgo = ranges[filterDateRange];
      if (daysAgo) {
        const cutoffDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(item => {
          if (!item.publishDate) return false;
          const pubDate = new Date(item.publishDate);
          return pubDate >= cutoffDate;
        });
      }
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Handle special cases
      if (sortField === 'publishDate') {
        aVal = aVal ? new Date(aVal) : new Date(0);
        bVal = bVal ? new Date(bVal) : new Date(0);
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [data, searchTerm, filterType, filterAudience, filterDateRange, filterTopic, sortField, sortDirection]);

  /**
   * Handle sort
   */
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  /**
   * Check if content is new (within last 7 days)
   */
  const isNew = (item) => {
    if (!item.firstSeen) return false;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const firstSeenDate = new Date(item.firstSeen);
    return firstSeenDate >= sevenDaysAgo;
  };

  /**
   * Export to CSV
   */
  const exportToCSV = () => {
    if (!filteredContent.length) return;

    const headers = ['Title', 'URL', 'Type', 'Publish Date', 'Categories', 'Audience', 'Description'];
    const rows = filteredContent.map(item => [
      item.title,
      item.url,
      item.contentType,
      item.publishDate || '',
      item.categories.join('; '),
      item.targetAudience.join('; '),
      item.metaDescription
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `hinge-content-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * Prepare chart data
   */
  const chartData = useMemo(() => {
    if (!data || !data.content) return { byType: [], byMonth: [], topTopics: [] };

    // Content by type
    const byType = Object.entries(data.summary?.contentByType || {})
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    // Content by month (last 12 months)
    const byMonth = {};
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = date.toISOString().substring(0, 7);
      byMonth[key] = 0;
    }

    data.content.forEach(item => {
      if (item.publishDate) {
        const monthKey = item.publishDate.substring(0, 7);
        if (byMonth.hasOwnProperty(monthKey)) {
          byMonth[monthKey]++;
        }
      }
    });

    const byMonthArray = Object.entries(byMonth).map(([month, count]) => ({
      month,
      count
    }));

    // Top topics
    const topTopics = Object.entries(data.summary?.topCategories || {})
      .slice(0, 10)
      .map(([topic, count]) => ({ topic, count }));

    return { byType, byMonth: byMonthArray, topTopics };
  }, [data]);

  /**
   * Render loading state
   */
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          <div style={styles.spinner}></div>
          <p>Loading content data...</p>
        </div>
      </div>
    );
  }

  /**
   * Render error state
   */
  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>
          <h2>Error Loading Data</h2>
          <p>{error}</p>
          <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
            Please ensure you've run the monitoring script first: <code>npm run monitor</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.title}>Hinge Health Content Monitor</h1>
        <p style={styles.subtitle}>
          Competitor content analysis dashboard
        </p>
        <p style={styles.lastUpdated}>
          Last updated: {new Date(data.lastUpdated).toLocaleString()}
        </p>
      </header>

      {/* Stats Cards */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{data.totalContent}</div>
          <div style={styles.statLabel}>Total Content</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{data.summary.newContentCount}</div>
          <div style={styles.statLabel}>New This Run</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>
            {filteredContent.filter(item => isNew(item)).length}
          </div>
          <div style={styles.statLabel}>Last 7 Days</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>
            {Object.keys(data.summary.contentByType || {}).length}
          </div>
          <div style={styles.statLabel}>Content Types</div>
        </div>
      </div>

      {/* Charts */}
      <div style={styles.chartsGrid}>
        {/* Content by Type */}
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Content by Type</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={chartData.byType}
                dataKey="count"
                nameKey="type"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={(entry) => `${entry.type}: ${entry.count}`}
              >
                {chartData.byType.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Publishing Timeline */}
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Publishing Timeline (12 Months)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData.byMonth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="count" stroke="#0088FE" name="Content Published" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top Topics */}
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Top Topics</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData.topTopics} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="topic" type="category" width={100} />
              <Tooltip />
              <Bar dataKey="count" fill="#00C49F" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tag Cloud */}
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Topic Tags</h3>
          <div style={styles.tagCloud}>
            {Object.entries(data.summary.topCategories || {})
              .slice(0, 30)
              .map(([topic, count], index) => {
                const fontSize = Math.max(12, Math.min(24, 12 + (count / 10)));
                return (
                  <span
                    key={index}
                    style={{
                      ...styles.tag,
                      fontSize: `${fontSize}px`,
                      color: COLORS[index % COLORS.length]
                    }}
                    onClick={() => setFilterTopic(topic)}
                  >
                    {topic}
                  </span>
                );
              })}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={styles.filtersSection}>
        <div style={styles.filtersRow}>
          <input
            type="text"
            placeholder="Search content..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={styles.select}
          >
            <option value="all">All Types</option>
            {filterOptions.types.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>

          <select
            value={filterAudience}
            onChange={(e) => setFilterAudience(e.target.value)}
            style={styles.select}
          >
            <option value="all">All Audiences</option>
            {filterOptions.audiences.map(audience => (
              <option key={audience} value={audience}>{audience}</option>
            ))}
          </select>

          <select
            value={filterDateRange}
            onChange={(e) => setFilterDateRange(e.target.value)}
            style={styles.select}
          >
            <option value="all">All Time</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
            <option value="180days">Last 6 Months</option>
            <option value="365days">Last Year</option>
          </select>

          <select
            value={filterTopic}
            onChange={(e) => setFilterTopic(e.target.value)}
            style={styles.select}
          >
            <option value="all">All Topics</option>
            {filterOptions.topics.slice(0, 50).map(topic => (
              <option key={topic} value={topic}>{topic}</option>
            ))}
          </select>

          <button onClick={exportToCSV} style={styles.exportButton}>
            Export CSV
          </button>

          <button
            onClick={() => {
              setSearchTerm('');
              setFilterType('all');
              setFilterAudience('all');
              setFilterDateRange('all');
              setFilterTopic('all');
            }}
            style={styles.clearButton}
          >
            Clear Filters
          </button>
        </div>

        <div style={styles.resultsInfo}>
          Showing {filteredContent.length} of {data.totalContent} content pieces
        </div>
      </div>

      {/* Content Table */}
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th} onClick={() => handleSort('title')}>
                Title {sortField === 'title' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th style={styles.th} onClick={() => handleSort('contentType')}>
                Type {sortField === 'contentType' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th style={styles.th} onClick={() => handleSort('publishDate')}>
                Date {sortField === 'publishDate' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th style={styles.th}>Categories</th>
              <th style={styles.th}>Audience</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredContent.map((item, index) => (
              <tr key={index} style={styles.tr}>
                <td style={styles.td}>
                  <div style={styles.titleCell}>
                    {item.title}
                    {isNew(item) && <span style={styles.newBadge}>NEW</span>}
                  </div>
                </td>
                <td style={styles.td}>
                  <span style={styles.typeBadge}>{item.contentType}</span>
                </td>
                <td style={styles.td}>
                  {item.publishDate || 'N/A'}
                </td>
                <td style={styles.td}>
                  <div style={styles.categories}>
                    {item.categories.slice(0, 3).map((cat, i) => (
                      <span key={i} style={styles.categoryTag}>{cat}</span>
                    ))}
                    {item.categories.length > 3 && (
                      <span style={styles.categoryTag}>+{item.categories.length - 3}</span>
                    )}
                  </div>
                </td>
                <td style={styles.td}>
                  {item.targetAudience.join(', ')}
                </td>
                <td style={styles.td}>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.link}
                  >
                    View →
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredContent.length === 0 && (
          <div style={styles.noResults}>
            <p>No content found matching your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Styles
const styles = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '2rem',
    maxWidth: '1400px',
    margin: '0 auto',
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '8px',
    marginBottom: '2rem',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  title: {
    margin: 0,
    fontSize: '2rem',
    color: '#333',
  },
  subtitle: {
    margin: '0.5rem 0 0 0',
    color: '#666',
    fontSize: '1rem',
  },
  lastUpdated: {
    margin: '0.5rem 0 0 0',
    color: '#999',
    fontSize: '0.875rem',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem',
  },
  statCard: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    textAlign: 'center',
  },
  statValue: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    color: '#0088FE',
  },
  statLabel: {
    marginTop: '0.5rem',
    color: '#666',
    fontSize: '0.875rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  chartsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem',
  },
  chartCard: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  chartTitle: {
    margin: '0 0 1rem 0',
    fontSize: '1.125rem',
    color: '#333',
  },
  tagCloud: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    padding: '1rem 0',
  },
  tag: {
    cursor: 'pointer',
    padding: '0.25rem 0.5rem',
    transition: 'all 0.2s',
    fontWeight: 500,
  },
  filtersSection: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    marginBottom: '2rem',
  },
  filtersRow: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap',
    marginBottom: '1rem',
  },
  searchInput: {
    flex: '1 1 300px',
    padding: '0.5rem 1rem',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '0.875rem',
  },
  select: {
    padding: '0.5rem 1rem',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '0.875rem',
    backgroundColor: 'white',
    cursor: 'pointer',
  },
  exportButton: {
    padding: '0.5rem 1.5rem',
    backgroundColor: '#0088FE',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '0.875rem',
    cursor: 'pointer',
    fontWeight: 500,
  },
  clearButton: {
    padding: '0.5rem 1.5rem',
    backgroundColor: '#666',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '0.875rem',
    cursor: 'pointer',
    fontWeight: 500,
  },
  resultsInfo: {
    color: '#666',
    fontSize: '0.875rem',
  },
  tableContainer: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '1rem',
    textAlign: 'left',
    backgroundColor: '#f8f9fa',
    fontWeight: 600,
    fontSize: '0.875rem',
    color: '#333',
    cursor: 'pointer',
    userSelect: 'none',
    borderBottom: '2px solid #ddd',
  },
  tr: {
    borderBottom: '1px solid #eee',
  },
  td: {
    padding: '1rem',
    fontSize: '0.875rem',
    color: '#333',
  },
  titleCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  newBadge: {
    display: 'inline-block',
    padding: '0.125rem 0.5rem',
    backgroundColor: '#00C49F',
    color: 'white',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  typeBadge: {
    display: 'inline-block',
    padding: '0.25rem 0.75rem',
    backgroundColor: '#f0f0f0',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 500,
    textTransform: 'capitalize',
  },
  categories: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.25rem',
  },
  categoryTag: {
    display: 'inline-block',
    padding: '0.125rem 0.5rem',
    backgroundColor: '#e8f4f8',
    color: '#0088FE',
    borderRadius: '4px',
    fontSize: '0.75rem',
  },
  link: {
    color: '#0088FE',
    textDecoration: 'none',
    fontWeight: 500,
  },
  noResults: {
    padding: '3rem',
    textAlign: 'center',
    color: '#999',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
    color: '#666',
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #0088FE',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  error: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    textAlign: 'center',
    color: '#d32f2f',
  },
};

export default HingeDashboard;
