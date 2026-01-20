---
title: "Why Use a Set Instead of an Array in JavaScript?"
description: Sharing practical tips and the latest trends in JavaScript
pubDate: "2024-05-15"
conclusion: "☝ Using a Set to check if an element belongs to a list is often much more performant than using an array, especially when the list is long. This reduces the time complexity, significantly improving code performance. For frequent lookup operations, prefer optimized data structures like Set."
image: "/images/posts/greg-rakozy-vw3Ahg4x1tY-unsplash.webp"
---

In dev, choosing the appropriate data structure is often crucial for optimizing your code's performance. Here is a practical example illustrating this concept by comparing two methods of checking if an element belongs to an admin list within a user list.

## Context

We have a list of user IDs `userIds` and a sublist of admin IDs `adminIdsArray`. We want to count how many users are admins. For this, we have two methods:

### a) Setup

```javascript
// setup:
const userIds = Array.from({ length: 1000 }).map((_, i) => i);
const adminIdsArray = userIds.slice(0, 10);
const adminIdsSet = new Set(adminIdsArray);
```

### b) Method 1: Using an Array

```javascript
let _ = 0;
for (let i = 0; i < userIds.length; i++) {
  if (adminIdsArray.includes(userIds[i])) {
    _ += 1;
  }
}
```

### c) Method 2: Using a `Set`

```javascript
let _ = 0;
for (let i = 0; i < userIds.length; i++) {
  if (adminIdsSet.has(userIds[i])) {
    _ += 1;
  }
}
```

## Complexity Analysis

### a) Method 1: `Array.includes()`

The `includes()` method checks if an array contains a certain value. In the worst case, it must traverse the entire array, giving a time complexity of $ O(m) $, where $ m $ is the size of the array. Since this check is performed for each element in `userIds`, the total complexity of this method is $ O(n \times m) $, where $ n $ is the number of users and $ m $ is the number of admins.

### b) Method 2: `Set.has()`

The `has()` method of a `Set` is much more efficient for checking the presence of an element, with an average time complexity of $ O(1) $. Therefore, the total complexity for checking all users is $ O(n) $, where $ n $ is the number of users.

## Performance Comparison

The performance difference between the two methods becomes significant as the lists grow larger.

> - **Method 1**: For each user, the admin array must be traversed until the element is found or the end of the array is reached. If `userIds` has 1000 elements and `adminIdsArray` has 10, the total complexity is $ 1000 \times 10 = 10,000 $ operations.
> - **Method 2**: Using a `Set`, each presence check is immediate, so for 1000 users, the total complexity is simply $ 1000 $ operations.

### Illustrative Example

To visualize this difference, imagine `userIds` represents a crowd of 1000 people, and `adminIdsArray` represents a group of 10 VIPs. If you need to check each person in the crowd to see if they are a VIP:

> - With **Method 1**, for each person, you traverse the list of 10 VIPs, which is like asking each person if they are a VIP and checking a list of names each time.
> - With **Method 2**, each person wears a badge directly indicating if they are a VIP, allowing an instant check.
