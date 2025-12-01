/**
 * parliament-edit tool - Create or update a file with content
 */
export function toolEdit(session, args) {
    if (args.length < 2) {
        return { status: 'error', message: 'Usage: parliament-edit [file] [content]', exitCode: 1 };
    }

    const filename = args[0];
    if (!filename) {
        return { status: 'error', message: 'Filename required', exitCode: 1 };
    }

    // Extract content from remaining arguments
    // Content may be in quotes, backticks, or as separate arguments
    const contentArgs = args.slice(1);
    
    // Try to find quoted or backtick-delimited content first
    const fullContent = contentArgs.join(' ');
    let content = '';
    
    // Try backticks first (triple or more)
    let contentMatch = fullContent.match(/```+([\s\S]*?)```+/);
    if (contentMatch) {
        content = contentMatch[1];
    } else {
        // Try double quotes
        contentMatch = fullContent.match(/"([\s\S]*?)"/);
        if (contentMatch) {
            content = contentMatch[1];
        } else {
            // Try single quotes
            contentMatch = fullContent.match(/'([\s\S]*?)'/);
            if (contentMatch) {
                content = contentMatch[1];
            } else {
                // Use all remaining args as content (join with spaces)
                content = contentArgs.join(' ');
            }
        }
    }

    // Create or update the file
    const existed = session.files.hasOwnProperty(filename);
    session.files[filename] = content;

    return {
        status: 'success',
        message: existed ? `File ${filename} updated` : `File ${filename} created`,
        data: { filename, content },
        exitCode: 0
    };
}

