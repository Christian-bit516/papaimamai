const deleteFast = async () => {
    let token = '';
    const allDocs = [];
    console.log('Fetching all documents...');
    do {
        const url = `https://firestore.googleapis.com/v1/projects/meme-bea08/databases/(default)/documents/leads${token ? '?pageToken=' + token : ''}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.documents) {
            allDocs.push(...data.documents);
        }
        token = data.nextPageToken;
    } while (token);

    console.log(`Found ${allDocs.length} documents. Ensuring only 1500 are left...`);
    const target = 1500;
    if (allDocs.length <= target) {
        console.log('Already at or below 1500 docs.');
        return;
    }
    
    const docsToDelete = allDocs.slice(target); // keep first 1500
    
    console.log(`Deleting ${docsToDelete.length} documents in parallel...`);
    
    // Process in batches of 100
    for (let i = 0; i < docsToDelete.length; i += 100) {
        const batch = docsToDelete.slice(i, i + 100);
        await Promise.all(batch.map(doc => fetch(`https://firestore.googleapis.com/v1/${doc.name}`, {method: 'DELETE'})));
        console.log(`Deleted batch ${i + 1} to ${i + batch.length}`);
    }
    console.log(`Done.`);
};
deleteFast();
