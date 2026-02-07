# Quiz: Return to Mobile App

When users open the quiz from the **mobile app**, the "Return to NFT project" button should open the mobile app (`opend://`) instead of the web app.

## How It Works

The mobile app appends `returnTo=mobile` to the quiz URL when opening it:

```
http://127.0.0.1:3000/quiz/ic?principalId=xxx&returnTo=mobile
```

## Change Needed in Quiz Project

Update your quiz's "Return to NFT project" button/link logic:

1. **Read the URL** on the page where the return button is shown (e.g. quiz completion screen).
2. **Check for `returnTo=mobile`** in the query string:
   ```javascript
   const params = new URLSearchParams(window.location.search);
   const returnToMobile = params.get('returnTo') === 'mobile';
   ```
3. **Redirect accordingly**:
   - If `returnToMobile`: use `window.location.href = 'opend://'` or `<a href="opend://">Return to OpenD</a>`
   - Else: use your existing web app URL (e.g. `http://localhost:8000` or your production URL)

### Example (vanilla JS)
```javascript
function getReturnUrl() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('returnTo') === 'mobile') {
    return 'opend://';
  }
  return 'http://localhost:8000'; // or your web app URL
}

// On button click or link:
document.getElementById('return-btn').href = getReturnUrl();
```

### Example (React)
```jsx
const returnUrl = new URLSearchParams(window.location.search).get('returnTo') === 'mobile'
  ? 'opend://'
  : 'http://localhost:8000';

<a href={returnUrl}>Return to NFT project</a>
```

The `opend://` scheme will cause the OS to open the OpenD mobile app when the user taps the link.
