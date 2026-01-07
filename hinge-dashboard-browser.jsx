/**
 * Hinge Health Competitive Intelligence Dashboard - Browser Version
 * Compatible with Babel standalone (no build step required)
 */

// Get React hooks and Recharts from global scope
const { useState, useEffect } = React;
const { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } = Recharts;

// Configuration - Update this URL for GitHub Pages deployment
const DATA_SOURCE_URL = './hinge-intelligence.json';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF6B6B'];

const HingeIntelligenceDashboard = () => {
  console.log('Dashboard component rendering...');

  const [intelligence, setIntelligence] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedPriority, setExpandedPriority] = useState(null);

  useEffect(() => {
    console.log('useEffect triggered, loading intelligence...');
    loadIntelligence();
  }, []);

  const loadIntelligence = async () => {
    try {
      console.log('Fetching from:', DATA_SOURCE_URL);
      setLoading(true);
      const response = await fetch(DATA_SOURCE_URL);

      console.log('Fetch response:', response.status, response.statusText);

      if (!response.ok) {
        throw new Error(`Could not load intelligence data (${response.status}). Please run: npm run generate-intelligence`);
      }

      const data = await response.json();
      console.log('Intelligence data loaded:', {
        totalPieces: data.metadata?.totalPieces,
        priorities: data.strategicPriorities?.length,
        hasAllSections: !!(data.trendingUp && data.audienceStrategy && data.campaigns)
      });

      setIntelligence(data);
      setError(null);
    } catch (err) {
      console.error('Error loading intelligence:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          <div style={styles.spinner}></div>
          <p>Loading intelligence data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>
          <h2>⚠️ Error Loading Data</h2>
          <p>{error}</p>
          <p style={{marginTop: '20px', fontSize: '14px', color: '#666'}}>
            Make sure to run: <code>npm run generate-intelligence</code>
          </p>
          <button onClick={loadIntelligence} style={styles.retryButton}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!intelligence) {
    console.log('No intelligence data available');
    return null;
  }

  console.log('Rendering dashboard with data');

  const tabs = [
    { id: 'overview', label: '📊 Overview', icon: '📊' },
    { id: 'priorities', label: '🎯 Strategic Priorities', icon: '🎯' },
    { id: 'trending', label: '📈 Trending', icon: '📈' },
    { id: 'audience', label: '👥 Audience', icon: '👥' },
    { id: 'messaging', label: '💬 Messaging', icon: '💬' },
    { id: 'campaigns', label: '🚀 Campaigns', icon: '🚀' },
    { id: 'gaps', label: '⚠️ Gaps', icon: '⚠️' },
    { id: 'quality', label: '💎 Quality', icon: '💎' },
    { id: 'insights', label: '💡 Insights', icon: '💡' },
    { id: 'data', label: '📄 Raw Data', icon: '📄' }
  ];

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Hinge Health Competitive Intelligence</h1>
          <p style={styles.subtitle}>
            Last Updated: {new Date(intelligence.lastUpdated).toLocaleString()}
            {' • '}
            {intelligence.metadata.totalPieces.toLocaleString()} pieces analyzed
          </p>
        </div>
        <button onClick={loadIntelligence} style={styles.refreshButton}>
          🔄 Refresh
        </button>
      </header>

      {/* Navigation Tabs */}
      <nav style={styles.tabs}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.tabActive : {})
            }}
          >
            <span style={styles.tabIcon}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Tab Content */}
      <main style={styles.main}>
        {activeTab === 'overview' && <OverviewTab intelligence={intelligence} />}
        {activeTab === 'priorities' && (
          <PrioritiesTab
            priorities={intelligence.strategicPriorities}
            expanded={expandedPriority}
            setExpanded={setExpandedPriority}
          />
        )}
        {activeTab === 'trending' && <TrendingTab trending={intelligence.trendingUp} declining={intelligence.trendingDown} />}
        {activeTab === 'audience' && <AudienceTab audience={intelligence.audienceStrategy} />}
        {activeTab === 'messaging' && <MessagingTab messaging={intelligence.messaging} />}
        {activeTab === 'campaigns' && <CampaignsTab campaigns={intelligence.campaigns} />}
        {activeTab === 'gaps' && <GapsTab gaps={intelligence.contentGaps} />}
        {activeTab === 'quality' && <QualityTab quality={intelligence.qualityMetrics} />}
        {activeTab === 'insights' && <InsightsTab insights={intelligence.keyInsights} />}
        {activeTab === 'data' && <RawDataTab rawContent={intelligence.rawContent} />}
      </main>
    </div>
  );
};

// Overview Tab Component
const OverviewTab = ({ intelligence }) => (
  <div style={styles.tabContent}>
    <h2 style={styles.sectionTitle}>Content Overview</h2>

    <div style={styles.cardGrid}>
      <div style={styles.statCard}>
        <div style={styles.statValue}>{intelligence.metadata.totalPieces.toLocaleString()}</div>
        <div style={styles.statLabel}>Total Pieces</div>
      </div>
      <div style={styles.statCard}>
        <div style={styles.statValue}>{intelligence.metadata.withDatesPct}</div>
        <div style={styles.statLabel}>With Dates</div>
      </div>
      <div style={styles.statCard}>
        <div style={styles.statValue}>{intelligence.strategicPriorities.length}</div>
        <div style={styles.statLabel}>Strategic Topics</div>
      </div>
      <div style={styles.statCard}>
        <div style={styles.statValue}>{intelligence.trendingUp.length}</div>
        <div style={styles.statLabel}>Trending Up</div>
      </div>
    </div>

    <div style={styles.card}>
      <h3 style={styles.cardTitle}>Date Range</h3>
      <p style={{fontSize: '16px', color: '#555'}}>
        {intelligence.metadata.dateRange.earliest} to {intelligence.metadata.dateRange.latest}
      </p>
    </div>

    <div style={styles.card}>
      <h3 style={styles.cardTitle}>Quick Summary</h3>
      <ul style={{lineHeight: '1.8', color: '#555'}}>
        <li><strong>{intelligence.strategicPriorities[0]?.count} pieces</strong> on {intelligence.strategicPriorities[0]?.topic} ({intelligence.strategicPriorities[0]?.percentage})</li>
        <li><strong>{intelligence.audienceStrategy.breakdown[0]?.count} pieces</strong> target {intelligence.audienceStrategy.breakdown[0]?.audience}</li>
        <li><strong>{intelligence.trendingUp[0]?.topic}</strong> trending up +{intelligence.trendingUp[0]?.change}%</li>
        <li><strong>{intelligence.contentGaps.zeroCoverage.length} content gaps</strong> with zero coverage</li>
      </ul>
    </div>
  </div>
);

// Strategic Priorities Tab
const PrioritiesTab = ({ priorities, expanded, setExpanded }) => {
  const chartData = priorities.map(p => ({
    name: p.topic,
    count: p.count,
    percentage: parseFloat(p.percentage)
  }));

  return (
    <div style={styles.tabContent}>
      <h2 style={styles.sectionTitle}>🎯 Strategic Priorities</h2>
      <p style={styles.sectionDesc}>Top 10 topics showing major content investment</p>

      <div style={styles.card}>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 120 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" />
            <Tooltip />
            <Bar dataKey="count" fill="#0088FE" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={styles.prioritiesList}>
        {priorities.map(priority => (
          <div key={priority.rank} style={styles.priorityCard}>
            <div
              style={styles.priorityHeader}
              onClick={() => setExpanded(expanded === priority.rank ? null : priority.rank)}
            >
              <span style={styles.priorityRank}>{priority.rank}</span>
              <div style={{flex: 1}}>
                <h3 style={styles.priorityTitle}>
                  {priority.topic.charAt(0).toUpperCase() + priority.topic.slice(1)}
                </h3>
                <p style={styles.priorityStats}>
                  {priority.count} pieces ({priority.percentage}) • {priority.interpretation}
                </p>
              </div>
              <span style={styles.expandIcon}>{expanded === priority.rank ? '▼' : '▶'}</span>
            </div>

            {expanded === priority.rank && (
              <div style={styles.priorityDetails}>
                {priority.subtopics && (
                  <div style={styles.subtopics}>
                    <h4 style={styles.detailsTitle}>Subtopics:</h4>
                    {priority.subtopics.map((sub, i) => (
                      <div key={i} style={styles.subtopicItem}>
                        <span>{sub.name}: </span>
                        <strong>{sub.count} pieces ({sub.percentage})</strong>
                      </div>
                    ))}
                  </div>
                )}

                {priority.contentTypes && (
                  <div style={styles.subtopics}>
                    <h4 style={styles.detailsTitle}>Content Types:</h4>
                    {priority.contentTypes.map((type, i) => (
                      <div key={i} style={styles.subtopicItem}>
                        <span>{type.name}: </span>
                        <strong>{type.count} pieces ({type.percentage})</strong>
                      </div>
                    ))}
                  </div>
                )}

                <div style={styles.examples}>
                  <h4 style={styles.detailsTitle}>Examples:</h4>
                  {priority.examples.map((ex, i) => (
                    <div key={i} style={styles.exampleItem}>
                      <a href={ex.url} target="_blank" rel="noopener noreferrer" style={styles.exampleLink}>
                        "{ex.title}"
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Trending Tab
const TrendingTab = ({ trending, declining }) => (
  <div style={styles.tabContent}>
    <h2 style={styles.sectionTitle}>📈 Trending Analysis</h2>
    <p style={styles.sectionDesc}>Content topics gaining and losing focus (Last 3 months)</p>

    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px'}}>
      {/* Trending Up */}
      <div style={styles.card}>
        <h3 style={{...styles.cardTitle, color: '#00C49F'}}>📈 Trending UP</h3>
        {trending.map((t, i) => (
          <div key={i} style={styles.trendItem}>
            <div style={styles.trendHeader}>
              <strong style={{color: '#00C49F'}}>{t.topic}</strong>
              <span style={{...styles.trendBadge, backgroundColor: '#00C49F'}}>+{t.change}%</span>
            </div>
            <div style={styles.trendDetails}>
              {t.recentCount} recent vs {t.olderCount} older
            </div>
            {t.examples && t.examples.length > 0 && (
              <div style={styles.trendExamples}>
                {t.examples.map((ex, j) => (
                  <div key={j} style={styles.trendExample}>• {ex.title.substring(0, 50)}...</div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Declining */}
      <div style={styles.card}>
        <h3 style={{...styles.cardTitle, color: '#FF8042'}}>📉 Declining</h3>
        {declining.map((t, i) => (
          <div key={i} style={styles.trendItem}>
            <div style={styles.trendHeader}>
              <strong style={{color: '#FF8042'}}>{t.topic}</strong>
              <span style={{...styles.trendBadge, backgroundColor: '#FF8042'}}>{t.change}%</span>
            </div>
            <div style={styles.trendDetails}>
              {t.recentCount} recent vs {t.olderCount} older
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Audience Tab
const AudienceTab = ({ audience }) => {
  const pieData = audience.breakdown.map((a, i) => ({
    name: a.audience,
    value: a.count,
    percentage: a.percentage
  }));

  const providerData = audience.providerDeepDive.breakdown.map((b, i) => ({
    name: b.type,
    value: b.count,
    percentage: b.percentage
  }));

  return (
    <div style={styles.tabContent}>
      <h2 style={styles.sectionTitle}>👥 Audience Strategy</h2>

      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px'}}>
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Audience Breakdown</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.percentage}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Provider Deep Dive</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={providerData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.percentage}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {providerData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{...styles.card, backgroundColor: '#E3F2FD'}}>
        <h3 style={styles.cardTitle}>💡 Strategic Insight</h3>
        <p style={{fontSize: '16px', lineHeight: '1.6'}}>
          {audience.providerDeepDive.interpretation}
        </p>
        <p style={{fontSize: '16px', marginTop: '10px'}}>
          <strong>B2B2C strategy:</strong> Partner with PTs who deliver care to members
        </p>
      </div>

      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Audience Shifts (Last 3 Months)</h3>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px'}}>
          <div>
            <h4 style={{color: '#00C49F', marginBottom: '10px'}}>Growing ↗</h4>
            {audience.shifts.growing.map((s, i) => (
              <div key={i} style={styles.shiftItem}>
                <span>{s.audience}</span>
                <span style={{color: '#00C49F', fontWeight: 'bold'}}>+{s.change}%</span>
              </div>
            ))}
          </div>
          <div>
            <h4 style={{color: '#FF8042', marginBottom: '10px'}}>Declining ↘</h4>
            {audience.shifts.declining.map((s, i) => (
              <div key={i} style={styles.shiftItem}>
                <span>{s.audience}</span>
                <span style={{color: '#FF8042', fontWeight: 'bold'}}>{s.change}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Messaging Tab
const MessagingTab = ({ messaging }) => {
  const chartData = messaging.byTopic.map(t => {
    const data = { topic: t.topic };
    t.themes.forEach(theme => {
      data[theme.theme] = parseInt(theme.percentage);
    });
    return data;
  });

  const allThemes = [...new Set(messaging.byTopic.flatMap(t => t.themes.map(th => th.theme)))];

  return (
    <div style={styles.tabContent}>
      <h2 style={styles.sectionTitle}>💬 Messaging Analysis</h2>
      <p style={styles.sectionDesc}>What they're saying about their top topics</p>

      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Messaging Themes by Topic</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="topic" />
            <YAxis />
            <Tooltip />
            <Legend />
            {allThemes.map((theme, i) => (
              <Bar key={theme} dataKey={theme} fill={COLORS[i % COLORS.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Key Claims They Make</h3>
        <ul style={{lineHeight: '2', fontSize: '16px'}}>
          {messaging.keyClaims.map((claim, i) => (
            <li key={i}>{claim}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

// Campaigns Tab
const CampaignsTab = ({ campaigns }) => {
  const chartData = campaigns.map(c => ({
    name: c.topic,
    count: c.count
  }));

  return (
    <div style={styles.tabContent}>
      <h2 style={styles.sectionTitle}>🚀 Content Campaigns Detected</h2>
      <p style={styles.sectionDesc}>Major strategic content pushes (50+ pieces)</p>

      <div style={styles.card}>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#8884D8" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={styles.campaignsList}>
        {campaigns.map((c, i) => (
          <div key={i} style={styles.campaignItem}>
            <div style={styles.campaignRank}>{i + 1}</div>
            <div style={{flex: 1}}>
              <strong style={{fontSize: '16px'}}>{c.topic}</strong>
              <span style={{marginLeft: '10px', color: '#666'}}>• {c.count} pieces</span>
              {c.interpretation && (
                <div style={{color: '#666', fontSize: '14px', marginTop: '4px'}}>
                  {c.interpretation}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Gaps Tab
const GapsTab = ({ gaps }) => (
  <div style={styles.tabContent}>
    <h2 style={styles.sectionTitle}>⚠️ Content Gaps & Opportunities</h2>

    <div style={styles.card}>
      <h3 style={{...styles.cardTitle, color: '#FF6B6B'}}>Zero Coverage (Major Gaps)</h3>
      <div style={styles.gapsList}>
        {gaps.zeroCoverage.map((gap, i) => (
          <div key={i} style={{...styles.gapItem, borderLeft: '4px solid #FF6B6B'}}>
            <div style={{fontWeight: 'bold', fontSize: '16px'}}>{gap.topic}</div>
            <div style={{color: '#666', fontSize: '14px', marginTop: '4px'}}>
              0 pieces{gap.opportunity && ` • ${gap.opportunity}`}
            </div>
          </div>
        ))}
      </div>
    </div>

    <div style={styles.card}>
      <h3 style={{...styles.cardTitle, color: '#FFBB28'}}>Limited Coverage (Opportunities)</h3>
      <div style={styles.gapsList}>
        {gaps.limitedCoverage.map((gap, i) => (
          <div key={i} style={{...styles.gapItem, borderLeft: '4px solid #FFBB28'}}>
            <div style={{fontWeight: 'bold', fontSize: '16px'}}>{gap.topic}</div>
            <div style={{color: '#666', fontSize: '14px', marginTop: '4px'}}>
              {gap.count} pieces{gap.opportunity && ` • ${gap.opportunity}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Quality Tab
const QualityTab = ({ quality }) => (
  <div style={styles.tabContent}>
    <h2 style={styles.sectionTitle}>💎 Quality Metrics</h2>

    <div style={styles.cardGrid}>
      <div style={styles.qualityCard}>
        <div style={styles.qualityValue}>{quality.metaDescriptions}%</div>
        <div style={styles.qualityLabel}>Meta Descriptions</div>
        <div style={styles.qualityBar}>
          <div style={{...styles.qualityFill, width: `${quality.metaDescriptions}%`}}></div>
        </div>
      </div>

      <div style={styles.qualityCard}>
        <div style={styles.qualityValue}>{quality.featuredImages}%</div>
        <div style={styles.qualityLabel}>Featured Images</div>
        <div style={styles.qualityBar}>
          <div style={{...styles.qualityFill, width: `${quality.featuredImages}%`}}></div>
        </div>
      </div>

      <div style={styles.qualityCard}>
        <div style={styles.qualityValue}>{quality.avgDescLength}</div>
        <div style={styles.qualityLabel}>Avg Description Length (chars)</div>
      </div>
    </div>
  </div>
);

// Insights Tab
const InsightsTab = ({ insights }) => (
  <div style={styles.tabContent}>
    <h2 style={styles.sectionTitle}>💡 Key Strategic Insights</h2>

    <div style={styles.insightsList}>
      {insights.map((insight, i) => (
        <div key={i} style={styles.insightCard}>
          <div style={styles.insightNumber}>{i + 1}</div>
          <div style={{flex: 1}}>
            <h3 style={styles.insightTitle}>{insight.title}</h3>
            <div style={styles.insightData}>{insight.data}</div>
            <p style={styles.insightText}>{insight.insight}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Raw Data Tab
const RawDataTab = ({ rawContent }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  const filtered = rawContent.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.metaDescription.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || item.contentType === filterType;
    return matchesSearch && matchesType;
  });

  const types = [...new Set(rawContent.map(item => item.contentType))].sort();

  return (
    <div style={styles.tabContent}>
      <h2 style={styles.sectionTitle}>📄 Raw Content Data</h2>

      <div style={styles.filters}>
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
          {types.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      <div style={styles.resultsCount}>
        Showing {filtered.length} of {rawContent.length} items
      </div>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Title</th>
              <th style={styles.th}>Type</th>
              <th style={styles.th}>Date</th>
              <th style={styles.th}>Audience</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map((item, i) => (
              <tr key={i} style={styles.tr}>
                <td style={styles.td}>
                  <a href={item.url} target="_blank" rel="noopener noreferrer" style={styles.link}>
                    {item.title}
                  </a>
                </td>
                <td style={styles.td}>{item.contentType}</td>
                <td style={styles.td}>{item.publishDate || 'N/A'}</td>
                <td style={styles.td}>{item.targetAudience.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Styles
const styles = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '20px',
    backgroundColor: '#f5f5f5',
    minHeight: '100vh'
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
    color: '#666'
  },
  spinner: {
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #0088FE',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    animation: 'spin 1s linear infinite',
    marginBottom: '20px'
  },
  error: {
    backgroundColor: '#FFF3CD',
    border: '1px solid #FFECB5',
    borderRadius: '8px',
    padding: '30px',
    margin: '40px',
    textAlign: 'center'
  },
  retryButton: {
    marginTop: '20px',
    padding: '10px 20px',
    backgroundColor: '#0088FE',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  header: {
    backgroundColor: 'white',
    padding: '20px 30px',
    borderRadius: '10px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    marginBottom: '20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: {
    margin: 0,
    fontSize: '28px',
    color: '#333'
  },
  subtitle: {
    margin: '8px 0 0 0',
    fontSize: '14px',
    color: '#666'
  },
  refreshButton: {
    padding: '10px 20px',
    backgroundColor: '#0088FE',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  tabs: {
    backgroundColor: 'white',
    borderRadius: '10px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    padding: '10px',
    marginBottom: '20px',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '5px'
  },
  tab: {
    padding: '10px 16px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    borderRadius: '5px',
    fontSize: '14px',
    color: '#666',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  tabActive: {
    backgroundColor: '#0088FE',
    color: 'white'
  },
  tabIcon: {
    fontSize: '16px'
  },
  main: {
    backgroundColor: 'white',
    borderRadius: '10px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    padding: '30px'
  },
  tabContent: {
    animation: 'fadeIn 0.3s ease-in'
  },
  sectionTitle: {
    fontSize: '24px',
    marginTop: 0,
    marginBottom: '8px',
    color: '#333'
  },
  sectionDesc: {
    color: '#666',
    marginBottom: '24px'
  },
  card: {
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '20px'
  },
  cardTitle: {
    fontSize: '18px',
    marginTop: 0,
    marginBottom: '16px',
    color: '#333'
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
    marginBottom: '20px'
  },
  statCard: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '24px',
    textAlign: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
  },
  statValue: {
    fontSize: '36px',
    fontWeight: 'bold',
    color: '#0088FE',
    marginBottom: '8px'
  },
  statLabel: {
    fontSize: '14px',
    color: '#666'
  },
  prioritiesList: {
    marginTop: '20px'
  },
  priorityCard: {
    backgroundColor: 'white',
    borderRadius: '8px',
    marginBottom: '12px',
    overflow: 'hidden',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
  },
  priorityHeader: {
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  priorityRank: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#0088FE',
    marginRight: '16px',
    minWidth: '40px'
  },
  priorityTitle: {
    margin: 0,
    fontSize: '18px',
    color: '#333'
  },
  priorityStats: {
    margin: '4px 0 0 0',
    fontSize: '14px',
    color: '#666'
  },
  expandIcon: {
    fontSize: '12px',
    color: '#999'
  },
  priorityDetails: {
    padding: '0 20px 20px 76px',
    backgroundColor: '#f9f9f9'
  },
  detailsTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    marginTop: '16px',
    marginBottom: '8px',
    color: '#555'
  },
  subtopics: {
    marginBottom: '16px'
  },
  subtopicItem: {
    padding: '6px 0',
    fontSize: '14px',
    color: '#666'
  },
  examples: {
    marginTop: '16px'
  },
  exampleItem: {
    padding: '6px 0'
  },
  exampleLink: {
    fontSize: '14px',
    color: '#0088FE',
    textDecoration: 'none'
  },
  trendItem: {
    padding: '12px 0',
    borderBottom: '1px solid #eee'
  },
  trendHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px'
  },
  trendBadge: {
    padding: '4px 8px',
    borderRadius: '4px',
    color: 'white',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  trendDetails: {
    fontSize: '13px',
    color: '#666',
    marginBottom: '8px'
  },
  trendExamples: {
    fontSize: '13px',
    color: '#777',
    paddingLeft: '12px'
  },
  trendExample: {
    marginTop: '4px'
  },
  shiftItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #eee'
  },
  campaignsList: {
    marginTop: '20px'
  },
  campaignItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px',
    backgroundColor: 'white',
    borderRadius: '8px',
    marginBottom: '12px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
  },
  campaignRank: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#0088FE',
    marginRight: '16px',
    minWidth: '32px'
  },
  gapsList: {
    display: 'grid',
    gap: '12px'
  },
  gapItem: {
    padding: '12px 16px',
    backgroundColor: 'white',
    borderRadius: '4px'
  },
  qualityCard: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '24px',
    textAlign: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
  },
  qualityValue: {
    fontSize: '36px',
    fontWeight: 'bold',
    color: '#00C49F',
    marginBottom: '8px'
  },
  qualityLabel: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '12px'
  },
  qualityBar: {
    height: '8px',
    backgroundColor: '#e0e0e0',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  qualityFill: {
    height: '100%',
    backgroundColor: '#00C49F',
    transition: 'width 0.3s'
  },
  insightsList: {
    display: 'grid',
    gap: '16px'
  },
  insightCard: {
    display: 'flex',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
  },
  insightNumber: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#0088FE',
    marginRight: '20px',
    minWidth: '48px'
  },
  insightTitle: {
    margin: '0 0 8px 0',
    fontSize: '18px',
    color: '#333',
    fontWeight: 'bold'
  },
  insightData: {
    fontSize: '16px',
    color: '#0088FE',
    fontWeight: 'bold',
    marginBottom: '8px'
  },
  insightText: {
    fontSize: '14px',
    color: '#666',
    lineHeight: '1.6',
    margin: 0
  },
  filters: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px'
  },
  searchInput: {
    flex: 1,
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '5px',
    fontSize: '14px'
  },
  select: {
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '5px',
    fontSize: '14px',
    minWidth: '150px'
  },
  resultsCount: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '12px'
  },
  tableContainer: {
    overflowX: 'auto',
    maxHeight: '600px',
    overflowY: 'auto'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  th: {
    padding: '12px',
    textAlign: 'left',
    borderBottom: '2px solid #ddd',
    backgroundColor: '#f9f9f9',
    position: 'sticky',
    top: 0,
    fontSize: '14px',
    fontWeight: 'bold'
  },
  tr: {
    borderBottom: '1px solid #eee'
  },
  td: {
    padding: '12px',
    fontSize: '14px'
  },
  link: {
    color: '#0088FE',
    textDecoration: 'none'
  }
};

console.log('Dashboard script loaded successfully');
