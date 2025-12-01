/**
 * parliament-edit tool - View files, propose amendments, or enact approved changes
 */
export function toolEdit(session, args) {
    const mode = args.find(a => a.startsWith('--'));

    if (mode === '--view') {
        const filename = args[0];
        const content = session.files[filename];
        if (!content) {
            return { status: 'error', message: 'File not found', exitCode: 4 };
        }
        return {
            status: 'success',
            message: `Viewing ${filename}`,
            data: { filename, content },
            exitCode: 0
        };
    } else if (mode === '--propose') {
        const filename = args[0];
        // Extract diff from quotes
        const diffMatch = args.join(' ').match(/"([^"]*)"/);
        const diff = diffMatch ? diffMatch[1] : '';

        const amendment = {
            id: `AMDT-${session.nextAmendmentId++}`,
            file: filename,
            diff,
            tabled: false,
            passed: false,
            created: new Date().toISOString()
        };

        session.amendments.push(amendment);

        return {
            status: 'success',
            message: `Amendment ${amendment.id} created`,
            data: amendment,
            exitCode: 0
        };
    } else if (mode === '--enact') {
        const amendmentId = args.find(a => a.startsWith('AMDT-'));
        const amendment = session.amendments.find(a => a.id === amendmentId);

        if (!amendment) {
            return { status: 'error', message: 'Amendment not found', exitCode: 4 };
        }

        if (!amendment.passed) {
            return { status: 'error', message: 'Amendment not passed', exitCode: 2 };
        }

        // Apply the diff (simple string replacement for now)
        const [from, to] = amendment.diff.split('->').map(s => s.trim());
        if (session.files[amendment.file]) {
            session.files[amendment.file] = session.files[amendment.file].replace(from, to);
        }

        return {
            status: 'success',
            message: `Amendment ${amendmentId} enacted`,
            data: { file: amendment.file },
            exitCode: 0
        };
    } else if (mode === '--view-amendment') {
        const amendmentId = args.find(a => a.startsWith('AMDT-'));
        const amendment = session.amendments.find(a => a.id === amendmentId);

        if (!amendment) {
            return { status: 'error', message: 'Amendment not found', exitCode: 4 };
        }

        return {
            status: 'success',
            message: `Viewing amendment ${amendmentId}`,
            data: amendment,
            exitCode: 0
        };
    } else if (mode === '--create') {
        const filename = args[0];
        if (!filename) {
            return { status: 'error', message: 'Filename required', exitCode: 1 };
        }

        // Extract content from quotes
        const contentMatch = args.join(' ').match(/"([^"]*)"/);
        const content = contentMatch ? contentMatch[1] : '';

        // Check if file already exists
        if (session.files[filename]) {
            return { status: 'error', message: 'File already exists. Use --propose to amend it.', exitCode: 2 };
        }

        // Create the file
        session.files[filename] = content;

        return {
            status: 'success',
            message: `File ${filename} created`,
            data: { filename, content },
            exitCode: 0
        };
    }

    return { status: 'error', message: 'Invalid mode', exitCode: 1 };
}

