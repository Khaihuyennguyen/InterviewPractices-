export interface PatternDefinition {
  name: string;
  category: 'coding' | 'sql' | 'system-design' | 'qa';
  description?: string;
}

// Standard Coding Interview Patterns (from Grokking / Educative curriculum)
export const CODING_PATTERNS: string[] = [
  'Two Pointers',
  'Sliding Window',
  'Fast & Slow Pointers',
  'Cyclic Sort',
  'Topological Sort',
  'Sort and Search',
  'Matrices',
  'Stacks',
  'Graphs',
  'Tree Depth-First Search',
  'Tree Breadth-First Search',
  'Trie',
  'Hash Maps',
  'Knowing What to Track',
  'Union Find',
  'Custom Data Structures',
  'Bitwise Manipulation',
  'Math and Geometry',
  'Dynamic Programming',
  'Backtracking',
  'Heaps & Priority Queues',
  'Greedy Algorithms',
];

// Standard SQL Interview Patterns
export const SQL_PATTERNS: string[] = [
  'Window Functions',
  'Self Joins & Hierarchy',
  'Common Table Expressions (CTEs)',
  'Aggregation & Grouping',
  'Cohort & Retention Analysis',
  'Pivot & Conditional (CASE WHEN)',
  'Date & Time Arithmetic',
  'Subqueries & Correlated Subqueries',
  'String & Text Manipulation',
  'Set Operations (UNION / EXCEPT)',
];

// System Design Patterns
export const SYSTEM_DESIGN_PATTERNS: string[] = [
  'High-Level Architecture',
  'Caching & CDN',
  'Database Sharding & Replication',
  'Rate Limiting & Gateways',
  'Message Queues & Event Streaming',
  'Load Balancing & Proxies',
  'Key-Value Stores',
  'Microservices & Consistency',
];

// Q&A / Conceptual Patterns
export const QA_PATTERNS: string[] = [
  'Python Internals & GIL',
  'Database Indexing & B-Trees',
  'ACID & Transactions',
  'Concurrency & Multithreading',
  'Memory Management & GC',
  'Networking & HTTP/REST',
  'Data Structures Deep-Dive',
];

/**
 * Returns the standard patterns list for a given topic.
 */
export function getStandardPatternsForTopic(topic: string): string[] {
  const norm = topic.toLowerCase().trim();
  if (norm === 'python' || norm === 'algorithms' || norm === 'coding') {
    return CODING_PATTERNS;
  }
  if (norm === 'sql') {
    return SQL_PATTERNS;
  }
  if (norm === 'system-design') {
    return SYSTEM_DESIGN_PATTERNS;
  }
  if (norm === 'qa') {
    return QA_PATTERNS;
  }
  return CODING_PATTERNS;
}
