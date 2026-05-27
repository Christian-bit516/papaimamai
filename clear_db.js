const clear = async () => {
    let token = '';
    do {
        const url = `https://firestore.googleapis.com/v1/projects/meme-bea08/databases/(default)/documents/leads${token ? '?pageToken=' + token : ''}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.documents) {
            for (let doc of data.documents) {
                await fetch(`https://firestore.googleapis.com/v1/${doc.name}`, {method: 'DELETE'});
                console.log('Deleted', doc.name);
            }
        }
        token = data.nextPageToken;
    } while (token);
    console.log('Done clearing database');
};
clear();
