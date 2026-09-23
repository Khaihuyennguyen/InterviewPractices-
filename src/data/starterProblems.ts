import { PracticeLink } from '../types';

export const STARTER_PROBLEMS: Omit<PracticeLink, 'uid'>[] = [
  {
    id: 'starter-sql-1',
    title: 'Department Top 3 Salaries',
    topic: 'sql',
    subTopic: 'Window Functions',
    difficulty: 'Intermediate',
    url: 'https://leetcode.com/problems/department-top-three-salaries/',
    notes: 'Use DENSE_RANK() OVER (PARTITION BY departmentId ORDER BY salary DESC) to handle salary ties cleanly.',
    questionContent: `A company's executives are interested in seeing who earns the most money in each of the company's departments. A high earner in a department is an employee who has a salary in the top three unique salaries for that department.

Write a solution to find the employees who are high earners in each of the departments.`,
    solutionContent: `WITH RankedSalaries AS (
  SELECT 
    d.name AS Department,
    e.name AS Employee,
    e.salary AS Salary,
    DENSE_RANK() OVER (
      PARTITION BY e.departmentId 
      ORDER BY e.salary DESC
    ) AS rnk
  FROM Employee e
  JOIN Department d ON e.departmentId = d.id
)
SELECT Department, Employee, Salary
FROM RankedSalaries
WHERE rnk <= 3;`,
    repetitions: 0,
    interval: 0,
    easinessFactor: 2.5,
    nextReviewDate: new Date().toISOString(),
    totalTimeSpent: 0,
    lastSolveTime: 0,
    averageSolveTime: 0,
    totalRepetitions: 0,
    personalDifficulty: 6,
    priorityScore: 8000,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'starter-sql-2',
    title: 'Consecutive Numbers',
    topic: 'sql',
    subTopic: 'Window Functions / LEAD',
    difficulty: 'Intermediate',
    url: 'https://leetcode.com/problems/consecutive-numbers/',
    notes: 'Find all numbers that appear at least three times consecutively in a table with consecutive IDs.',
    questionContent: `Find all numbers that appear at least three times consecutively.

Table: Logs
+----+-----+
| id | num |
+----+-----+
| 1  | 1   |
| 2  | 1   |
| 3  | 1   |
| 4  | 2   |
| 5  | 1   |
| 6  | 2   |
| 7  | 2   |
+----+-----+`,
    solutionContent: `SELECT DISTINCT num AS ConsecutiveNums
FROM (
  SELECT 
    num,
    LEAD(num, 1) OVER (ORDER BY id) AS next_1,
    LEAD(num, 2) OVER (ORDER BY id) AS next_2
  FROM Logs
) t
WHERE num = next_1 AND num = next_2;`,
    repetitions: 0,
    interval: 0,
    easinessFactor: 2.5,
    nextReviewDate: new Date().toISOString(),
    totalTimeSpent: 0,
    lastSolveTime: 0,
    averageSolveTime: 0,
    totalRepetitions: 0,
    personalDifficulty: 5,
    priorityScore: 7500,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'starter-sql-3',
    title: 'Second Highest Salary',
    topic: 'sql',
    subTopic: 'Aggregations / Subqueries',
    difficulty: 'Beginner',
    url: 'https://leetcode.com/problems/second-highest-salary/',
    notes: 'Remember to return NULL if there is no second highest salary (wrap in IFNULL or SELECT subquery).',
    questionContent: `Write a SQL query to get the second highest salary from the Employee table. If there is no second highest salary, query should report null.`,
    solutionContent: `SELECT (
  SELECT DISTINCT salary 
  FROM Employee 
  ORDER BY salary DESC 
  LIMIT 1 OFFSET 1
) AS SecondHighestSalary;`,
    repetitions: 0,
    interval: 0,
    easinessFactor: 2.5,
    nextReviewDate: new Date().toISOString(),
    totalTimeSpent: 0,
    lastSolveTime: 0,
    averageSolveTime: 0,
    totalRepetitions: 0,
    personalDifficulty: 3,
    priorityScore: 6500,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'starter-sql-4',
    title: 'Monthly Active Users & Retention',
    topic: 'sql',
    subTopic: 'Self Join & Cohorts',
    difficulty: 'Advanced',
    notes: 'Classic product data analyst problem: Calculate Month 1 retention rate for new signups.',
    questionContent: `Calculate the percentage of users who returned to the app in the month following their first sign-up month.`,
    solutionContent: `WITH FirstAction AS (
  SELECT user_id, DATE_TRUNC('month', MIN(event_date)) AS cohort_month
  FROM user_events
  GROUP BY user_id
),
Month1Retention AS (
  SELECT 
    f.cohort_month,
    COUNT(DISTINCT f.user_id) AS cohort_size,
    COUNT(DISTINCT e.user_id) AS retained_users
  FROM FirstAction f
  LEFT JOIN user_events e 
    ON f.user_id = e.user_id 
    AND DATE_TRUNC('month', e.event_date) = f.cohort_month + INTERVAL '1 month'
  GROUP BY f.cohort_month
)
SELECT 
  cohort_month,
  cohort_size,
  retained_users,
  ROUND(100.0 * retained_users / cohort_size, 2) AS retention_rate_pct
FROM Month1Retention
ORDER BY cohort_month;`,
    repetitions: 0,
    interval: 0,
    easinessFactor: 2.5,
    nextReviewDate: new Date().toISOString(),
    totalTimeSpent: 0,
    lastSolveTime: 0,
    averageSolveTime: 0,
    totalRepetitions: 0,
    personalDifficulty: 8,
    priorityScore: 9000,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'starter-py-1',
    title: 'Two Sum & Three Sum',
    topic: 'python',
    subTopic: 'Two Pointers & Hash Maps',
    difficulty: 'Beginner',
    url: 'https://leetcode.com/problems/two-sum/',
    notes: 'Two Sum uses a hash map for O(n). Three Sum sorts the array and uses two pointers with duplicate skipping.',
    questionContent: `Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.`,
    solutionContent: `def two_sum(nums: list[int], target: int) -> list[int]:
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []

# Three Sum:
def three_sum(nums: list[int]) -> list[list[int]]:
    nums.sort()
    res = []
    for i in range(len(nums) - 2):
        if i > 0 and nums[i] == nums[i - 1]:
            continue
        left, right = i + 1, len(nums) - 1
        while left < right:
            total = nums[i] + nums[left] + nums[right]
            if total < 0:
                left += 1
            elif total > 0:
                right -= 1
            else:
                res.append([nums[i], nums[left], nums[right]])
                while left < right and nums[left] == nums[left + 1]:
                    left += 1
                while left < right and nums[right] == nums[right - 1]:
                    right -= 1
                left += 1
                right -= 1
    return res`,
    repetitions: 0,
    interval: 0,
    easinessFactor: 2.5,
    nextReviewDate: new Date().toISOString(),
    totalTimeSpent: 0,
    lastSolveTime: 0,
    averageSolveTime: 0,
    totalRepetitions: 0,
    personalDifficulty: 4,
    priorityScore: 7000,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'starter-py-2',
    title: 'Longest Substring Without Repeating Characters',
    topic: 'python',
    subTopic: 'Sliding Window',
    difficulty: 'Intermediate',
    url: 'https://leetcode.com/problems/longest-substring-without-repeating-characters/',
    notes: 'Store last seen index of each char. When a repeat is found in the current window, move the left pointer to last_seen + 1.',
    questionContent: `Given a string s, find the length of the longest substring without repeating characters.`,
    solutionContent: `def length_of_longest_substring(s: str) -> int:
    char_map = {}
    left = 0
    max_len = 0
    
    for right, char in enumerate(s):
        if char in char_map and char_map[char] >= left:
            left = char_map[char] + 1
        char_map[char] = right
        max_len = max(max_len, right - left + 1)
        
    return max_len`,
    repetitions: 0,
    interval: 0,
    easinessFactor: 2.5,
    nextReviewDate: new Date().toISOString(),
    totalTimeSpent: 0,
    lastSolveTime: 0,
    averageSolveTime: 0,
    totalRepetitions: 0,
    personalDifficulty: 6,
    priorityScore: 8200,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'starter-py-3',
    title: 'Merge Intervals',
    topic: 'python',
    subTopic: 'Intervals & Sorting',
    difficulty: 'Intermediate',
    url: 'https://leetcode.com/problems/merge-intervals/',
    notes: 'Sort by start time. Compare current start with previous end to decide whether to merge or append.',
    questionContent: `Given an array of intervals where intervals[i] = [start_i, end_i], merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.`,
    solutionContent: `def merge(intervals: list[list[int]]) -> list[list[int]]:
    if not intervals:
        return []
    
    intervals.sort(key=lambda x: x[0])
    merged = [intervals[0]]
    
    for current in intervals[1:]:
        prev = merged[-1]
        if current[0] <= prev[1]:
            # Overlapping, merge by updating end
            prev[1] = max(prev[1], current[1])
        else:
            merged.append(current)
            
    return merged`,
    repetitions: 0,
    interval: 0,
    easinessFactor: 2.5,
    nextReviewDate: new Date().toISOString(),
    totalTimeSpent: 0,
    lastSolveTime: 0,
    averageSolveTime: 0,
    totalRepetitions: 0,
    personalDifficulty: 5,
    priorityScore: 7700,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'starter-py-4',
    title: 'LRU Cache Design',
    topic: 'python',
    subTopic: 'Data Structure Design',
    difficulty: 'Advanced',
    url: 'https://leetcode.com/problems/lru-cache/',
    notes: 'Combine a Hash Map with a Doubly Linked List (or collections.OrderedDict) for O(1) get and put operations.',
    questionContent: `Design a data structure that follows the constraints of a Least Recently Used (LRU) cache with get(key) and put(key, value) in O(1) time complexity.`,
    solutionContent: `class Node:
    def __init__(self, key=0, val=0):
        self.key = key
        self.val = val
        self.prev = None
        self.next = None

class LRUCache:
    def __init__(self, capacity: int):
        self.cap = capacity
        self.cache = {} # key -> Node
        self.head = Node()
        self.tail = Node()
        self.head.next = self.tail
        self.tail.prev = self.head

    def _remove(self, node: Node):
        prev, nxt = node.prev, node.next
        prev.next = nxt
        nxt.prev = prev

    def _add_to_front(self, node: Node):
        nxt = self.head.next
        self.head.next = node
        node.prev = self.head
        node.next = nxt
        nxt.prev = node

    def get(self, key: int) -> int:
        if key in self.cache:
            node = self.cache[key]
            self._remove(node)
            self._add_to_front(node)
            return node.val
        return -1

    def put(self, key: int, value: int) -> None:
        if key in self.cache:
            self._remove(self.cache[key])
        node = Node(key, value)
        self.cache[key] = node
        self._add_to_front(node)
        if len(self.cache) > self.cap:
            lru = self.tail.prev
            self._remove(lru)
            del self.cache[lru.key]`,
    repetitions: 0,
    interval: 0,
    easinessFactor: 2.5,
    nextReviewDate: new Date().toISOString(),
    totalTimeSpent: 0,
    lastSolveTime: 0,
    averageSolveTime: 0,
    totalRepetitions: 0,
    personalDifficulty: 9,
    priorityScore: 9200,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'starter-sd-1',
    title: 'Design a URL Shortener (TinyURL)',
    topic: 'system-design',
    subTopic: 'Hashing & Scalability',
    difficulty: 'Intermediate',
    url: 'https://github.com/donnemartin/system-design-primer',
    notes: 'Key tradeoffs: MD5/SHA256 truncated vs Base62 counter vs Key Generation Service (KGS). 80:20 read/write caching.',
    questionContent: `Design a scalable URL shortening service like bit.ly or TinyURL.

**Functional Requirements:**
1. Given a long URL, return a unique, shortened alias (e.g. 7 characters).
2. Given a short alias, redirect the user with HTTP 301/302 to original long URL.
3. Custom alias selection (optional).
4. Links expire after a default lifetime.

**Non-Functional Requirements:**
- High availability with sub-50ms redirect latency.
- Scale to 500M new URLs/month and 50B redirects/month (100:1 read-to-write ratio).`,
    solutionContent: `### High-Level Architecture:
1. **Traffic & Capacity Estimation:**
   - Writes: ~200 writes/sec; Reads: ~20,000 reads/sec (read-heavy).
   - Storage (5 years): 500M * 12 * 5 = 30B records * 500 bytes = ~15 TB.
2. **Short URL Generation:**
   - Use **Base62** ([A-Z, a-z, 0-9]). 62^7 = ~3.5 Trillion unique URLs.
   - **Key Generation Service (KGS)**: Generate random 7-char keys in advance in a separate database, load in memory to avoid collision detection at runtime.
3. **Database Schema (NoSQL e.g., DynamoDB or Cassandra):**
   - PK: short_key (string, 7 chars)
   - long_url (string)
   - user_id (string)
   - created_at, expires_at (timestamp)
4. **Caching & CDN:**
   - Redis cluster caching the top 20% most visited URLs (Pareto Principle).
   - HTTP 302 (Temporary Redirect) for accurate analytics tracking, or 301 (Permanent) to offload to browser cache.`,
    repetitions: 0,
    interval: 0,
    easinessFactor: 2.5,
    nextReviewDate: new Date().toISOString(),
    totalTimeSpent: 0,
    lastSolveTime: 0,
    averageSolveTime: 0,
    totalRepetitions: 0,
    personalDifficulty: 7,
    priorityScore: 8500,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'starter-sd-2',
    title: 'Design a Distributed Rate Limiter',
    topic: 'system-design',
    subTopic: 'API Gateways & Concurrency',
    difficulty: 'Advanced',
    url: 'https://bytebytego.com',
    notes: 'Compare algorithms: Token Bucket, Leaky Bucket, Sliding Window Counter. Address race conditions with Redis Lua scripts.',
    questionContent: `Design a distributed API rate limiter to protect backend services from abuse and DoS attacks (e.g., allow max 10 requests per second per IP or API key).

**Requirements:**
- Accurately limit requests with low latency overhead (< 2ms).
- Work across a multi-server distributed cluster.
- Return HTTP 429 (Too Many Requests) with Retry-After header when exceeded.`,
    solutionContent: `### Solution & Trade-offs:
1. **Algorithm Selection:**
   - **Token Bucket**: Refills tokens at constant rate. Allows bursts up to bucket capacity. Simple, memory efficient.
   - **Sliding Window Counter**: Balances accuracy and memory by tracking request counts in current and previous minute intervals.
2. **Distributed Storage:**
   - Use in-memory data store (**Redis**) for lightning-fast reads and decrements.
   - Run **Lua scripts** on Redis to make key inspection and counter decrement atomic, preventing race conditions under high concurrent load.
3. **Rate Limiting Architecture:**
   - Place as a middleware in the **API Gateway** layer (e.g. Envoy, Kong, or Nginx).
   - Header responses:
     - \`X-Ratelimit-Remaining\`
     - \`X-Ratelimit-Limit\`
     - \`X-Ratelimit-Retry-After\``,
    repetitions: 0,
    interval: 0,
    easinessFactor: 2.5,
    nextReviewDate: new Date().toISOString(),
    totalTimeSpent: 0,
    lastSolveTime: 0,
    averageSolveTime: 0,
    totalRepetitions: 0,
    personalDifficulty: 8,
    priorityScore: 8900,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'starter-qa-1',
    title: 'Python GIL, Threads, Multiprocessing & Async',
    topic: 'qa',
    subTopic: 'Python Core Concepts',
    difficulty: 'Intermediate',
    notes: 'Know the exact differences: CPU-bound (multiprocessing) vs I/O-bound (asyncio / threading). GIL enables simple CPython memory management.',
    questionContent: `What is the Python Global Interpreter Lock (GIL)? Why does it exist, and how does it affect CPU-bound vs I/O-bound programs? How do you achieve true parallelism in Python?`,
    solutionContent: `### Key Talking Points:
1. **What is the GIL?**
   - A mutex that prevents multiple native threads from executing Python bytecodes at the same time in CPython.
   - Only ONE thread can execute Python code at a time per process.
2. **Why does it exist?**
   - CPython's memory management uses reference counting. Without the GIL, reference count increments/decrements would suffer race conditions and memory leaks.
3. **Impact on Tasks:**
   - **I/O-Bound** (Network requests, database calls, disk I/O): Threads or \`asyncio\` work very well because the thread releases the GIL while waiting for I/O!
   - **CPU-Bound** (Data processing, math, compression): Multiple threads will NOT speed up execution; in fact, thread switching overhead makes it slower!
4. **Achieving True Parallelism:**
   - Use the \`multiprocessing\` module: Spawns independent Python processes, each with its own memory space and its own GIL.
   - Use C extensions / libraries that release the GIL (e.g., NumPy, Polars, PyTorch).
   - Python 3.13+ free-threaded build (PEP 703 experimental nogil).`,
    repetitions: 0,
    interval: 0,
    easinessFactor: 2.5,
    nextReviewDate: new Date().toISOString(),
    totalTimeSpent: 0,
    lastSolveTime: 0,
    averageSolveTime: 0,
    totalRepetitions: 0,
    personalDifficulty: 6,
    priorityScore: 7800,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'starter-qa-2',
    title: 'Database Indexing: B-Trees, Clustered vs Non-Clustered',
    topic: 'qa',
    subTopic: 'Database Internals',
    difficulty: 'Intermediate',
    notes: 'Clustered index physically orders table data (only 1 per table). Non-clustered has pointers back to clustered key.',
    questionContent: `Explain how B-Tree indexes work in relational databases (MySQL / PostgreSQL). What is the difference between a Clustered and a Non-Clustered Index? What is a Covering Index?`,
    solutionContent: `### Key Talking Points:
1. **B-Tree Structure:**
   - Balanced tree where all leaf nodes are at the same depth and linked sequentially (doubly-linked list for fast range scans).
   - Provides $O(\\log N)$ lookup, insertion, and deletion.
2. **Clustered Index:**
   - Determines the physical storage order of rows on disk.
   - Leaf nodes contain the **actual row data**.
   - Exactly **one** clustered index per table (typically the Primary Key).
3. **Non-Clustered (Secondary) Index:**
   - Separate structure from table data. Leaf nodes contain the indexed column values and a pointer (bookmark / clustered PK) to the row.
   - Requires a secondary lookup ("key lookup" or "bookmark lookup") unless the query is covering.
4. **Covering Index:**
   - An index that contains all columns needed by the query (\`SELECT\`, \`WHERE\`, \`ORDER BY\`).
   - The database satisfies the entire query from the index tree without touching table pages on disk!`,
    repetitions: 0,
    interval: 0,
    easinessFactor: 2.5,
    nextReviewDate: new Date().toISOString(),
    totalTimeSpent: 0,
    lastSolveTime: 0,
    averageSolveTime: 0,
    totalRepetitions: 0,
    personalDifficulty: 5,
    priorityScore: 7600,
    createdAt: new Date().toISOString(),
  }
];
