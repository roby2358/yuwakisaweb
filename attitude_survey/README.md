# Attitude Survey

Fun, humorous attitude surveys that score users on whimsical themes.

## Usage

Open `index.html` in a browser, or link directly to a theme:

- `?theme=halloween_fun` - Halloween Fun
- `?theme=tescreal` - TESCREAL
- `?theme=wirehead_poaster` - Wirehead Bluesky Poaster

## Adding Themes

Create a new JS file with your theme definition:

```javascript
const myTheme = {
    name: "My Theme",
    intro: "Introduction paragraph for the survey.",
    questionsPerCategory: 3,
    categories: [
        {
            name: "Category Name",
            positive: true,  // or false
            questions: [
                { text: "Question text here.", positive: true },
                // ...
            ]
        },
        // ...
    ]
};
```

Then add a `<script>` tag in `index.html` and register it in `index.js`.

## License

MIT
