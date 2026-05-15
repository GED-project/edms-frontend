# Documents Module Integration - Testing Checklist

## Pre-Test Setup

### Backend
- [ ] Backend is running on `https://localhost:44324`
- [ ] Database is migrated (run `GedProject.DbMigrator`)
- [ ] At least one test document exists in database
- [ ] Admin user exists with credentials

### Frontend
- [ ] Frontend is running on `http://localhost:5173`
- [ ] User is logged in
- [ ] Browser DevTools open (Network + Console tabs)

---

## Test Cases

### 1. Document List Loading
**Steps:**
1. Navigate to `/documents`
2. Wait for page to load

**Expected:**
- [ ] Loading spinner appears briefly
- [ ] Documents load from API
- [ ] Document count shows correct number
- [ ] No console errors
- [ ] Network tab shows successful `GET /api/app/document` request

**Actual Result:**
```
Status: ___________
Notes: ___________
```

---

### 2. Pagination
**Steps:**
1. If total documents > 8, pagination should appear
2. Click "Next page" button
3. Click "Previous page" button
4. Click specific page number

**Expected:**
- [ ] Page changes
- [ ] New documents load
- [ ] URL updates with page number
- [ ] Current page highlighted

**Actual Result:**
```
Status: ___________
Notes: ___________
```

---

### 3. Search
**Steps:**
1. Type document name in search box
2. Wait 300ms (debounce)
3. Clear search

**Expected:**
- [ ] Documents filter by title
- [ ] Loading indicator shows during search
- [ ] Results update automatically
- [ ] Clearing search shows all documents

**Actual Result:**
```
Status: ___________
Notes: ___________
```

---

### 4. View Modes (Table/Grid)
**Steps:**
1. Click Grid view button
2. Click Table view button

**Expected:**
- [ ] View switches between table and grid
- [ ] All documents visible in both views
- [ ] Active view button highlighted

**Actual Result:**
```
Status: ___________
Notes: ___________
```

---

### 5. Download Document
**Steps:**
1. Click "..." menu on a document
2. Click "Télécharger"

**Expected:**
- [ ] File downloads to browser
- [ ] Success toast appears
- [ ] Network tab shows `GET /api/app/document/{id}/download-document`

**Actual Result:**
```
Status: ___________
Notes: ___________
```

---

### 6. Move to Trash
**Steps:**
1. Click "..." menu on a document
2. Click "Supprimer"
3. Confirm deletion

**Expected:**
- [ ] Confirmation dialog appears
- [ ] Document disappears from list
- [ ] Success toast: "Document déplacé vers la corbeille"
- [ ] Total count decreases by 1
- [ ] Network tab shows `POST /api/app/document/{id}/move-to-trash`

**Actual Result:**
```
Status: ___________
Notes: ___________
```

---

### 7. View Trash
**Steps:**
1. Click "Corbeille" button
2. Verify deleted document appears

**Expected:**
- [ ] Page title changes to "Corbeille"
- [ ] Deleted documents appear
- [ ] Context menu shows "Restaurer" and "Supprimer définitivement"
- [ ] Network tab shows `GET /api/app/document/trash-items`

**Actual Result:**
```
Status: ___________
Notes: ___________
```

---

### 8. Restore from Trash
**Steps:**
1. In trash view, click "..." menu on a document
2. Click "Restaurer"

**Expected:**
- [ ] Document disappears from trash
- [ ] Success toast: "Document restauré"
- [ ] Network tab shows `POST /api/app/document/{id}/restore`
- [ ] Document reappears in main list

**Actual Result:**
```
Status: ___________
Notes: ___________
```

---

### 9. Hard Delete (Permanent)
**Steps:**
1. In trash view, click "..." menu on a document
2. Click "Supprimer définitivement"
3. Confirm deletion

**Expected:**
- [ ] Confirmation dialog appears
- [ ] Document disappears from trash
- [ ] Success toast: "Document supprimé définitivement"
- [ ] Network tab shows `DELETE /api/app/document/{id}/hard-delete`
- [ ] Document cannot be restored

**Actual Result:**
```
Status: ___________
Notes: ___________
```

---

### 10. Sorting
**Steps:**
1. Click sort button (ascending/descending)
2. Verify document order changes

**Expected:**
- [ ] Documents re-order by date
- [ ] Icon changes between ascending/descending
- [ ] Network request includes `sorting` parameter

**Actual Result:**
```
Status: ___________
Notes: ___________
```

---

### 11. Error Handling - Network Failure
**Steps:**
1. Stop backend server
2. Try to load documents page
3. Restart backend

**Expected:**
- [ ] Error message appears
- [ ] Red error toast shows
- [ ] No crash or white screen
- [ ] Page recovers when backend restarts

**Actual Result:**
```
Status: ___________
Notes: ___________
```

---

### 12. Error Handling - 401 Unauthorized
**Steps:**
1. Clear access token from memory (or wait for expiration)
2. Try to perform an action

**Expected:**
- [ ] Automatic token refresh attempt
- [ ] If refresh fails, redirect to login
- [ ] No console errors

**Actual Result:**
```
Status: ___________
Notes: ___________
```

---

### 13. Loading States
**Steps:**
1. Observe loading indicators during:
   - Initial page load
   - Pagination
   - Search
   - Delete/Restore actions

**Expected:**
- [ ] Spinner shows during initial load
- [ ] UI doesn't freeze during operations
- [ ] Loading states clear after completion

**Actual Result:**
```
Status: ___________
Notes: ___________
```

---

### 14. Empty State
**Steps:**
1. Delete all documents
2. View empty documents list

**Expected:**
- [ ] "Aucun document trouvé" message appears
- [ ] No errors
- [ ] Page remains functional

**Actual Result:**
```
Status: ___________
Notes: ___________
```

---

### 15. Document Details Navigation
**Steps:**
1. Click on a document title
2. Verify navigation to `/documents/{id}`

**Expected:**
- [ ] URL changes to document detail page
- [ ] (Note: Detail page not yet connected, may show mock data)

**Actual Result:**
```
Status: ___________
Notes: ___________
```

---

## Performance Tests

### 16. Large Dataset (100+ documents)
**Steps:**
1. Seed database with 100+ documents
2. Load documents page
3. Test pagination

**Expected:**
- [ ] Page loads in < 2 seconds
- [ ] Pagination works smoothly
- [ ] No memory leaks

**Actual Result:**
```
Status: ___________
Notes: ___________
```

---

### 17. Rapid Actions
**Steps:**
1. Quickly click multiple actions (delete, restore, etc.)
2. Verify no race conditions

**Expected:**
- [ ] All actions complete successfully
- [ ] No duplicate requests
- [ ] UI stays consistent

**Actual Result:**
```
Status: ___________
Notes: ___________
```

---

## Browser Compatibility

### 18. Chrome
- [ ] All features work
- [ ] No console errors

### 19. Firefox
- [ ] All features work
- [ ] No console errors

### 20. Edge
- [ ] All features work
- [ ] No console errors

---

## Summary

**Total Tests:** 20
**Passed:** ___
**Failed:** ___
**Blocked:** ___

**Critical Issues:**
```
1. ___________
2. ___________
3. ___________
```

**Minor Issues:**
```
1. ___________
2. ___________
3. ___________
```

**Notes:**
```
___________
___________
___________
```

---

**Tester:** ___________
**Date:** ___________
**Environment:** Development
**Backend Version:** ___________
**Frontend Version:** ___________
