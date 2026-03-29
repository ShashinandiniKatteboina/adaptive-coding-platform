const fs = require('fs');
const path = require('path');
const pool = require('./config/db');

async function sync() {
    const problemsDir = path.join(__dirname, 'problemsdata');
    const folders = fs.readdirSync(problemsDir);

    for (const folder of folders) {
        const folderPath = path.join(problemsDir, folder);
        
        // 1. Read metadata and statement
        const metadata = JSON.parse(fs.readFileSync(path.join(folderPath, 'metadata.json'), 'utf-8'));
        const statement = fs.readFileSync(path.join(folderPath, 'statement.md'), 'utf-8');

        console.log(`Syncing: ${metadata.title}...`);

        // 2. Upsert Problem into DB
        await pool.query(`
            INSERT INTO problems (id, title, description, difficulty, topic, input_labels)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO UPDATE SET 
                title = EXCLUDED.title, 
                description = EXCLUDED.description,
                difficulty = EXCLUDED.difficulty,
                topic = EXCLUDED.topic;
        `, [metadata.id, metadata.title, statement, metadata.difficulty, metadata.topic, metadata.input_labels]);

        // 3. Clear old test cases for this problem
        await pool.query('DELETE FROM test_cases WHERE problem_id = $1', [metadata.id]);

        // 4. Read all input/output files and insert them
        const files = fs.readdirSync(folderPath);
        const inputFiles = files.filter(f => f.startsWith('input_'));

        for (const inFile of inputFiles) {
            const index = inFile.split('_')[1].split('.')[0]; // Get "1" from "input_1.txt"
            const outFile = `output_${index}.txt`;

            const inputContent = fs.readFileSync(path.join(folderPath, inFile), 'utf-8').trim();
            const outputContent = fs.readFileSync(path.join(folderPath, outFile), 'utf-8').trim();
            
            // Assume files with index 1 and 2 are visible (false), others are hidden (true)
            const isHidden = parseInt(index) > 2;

            await pool.query(`
                INSERT INTO test_cases (problem_id, input, expected_output, is_hidden)
                VALUES ($1, $2, $3, $4)
            `, [metadata.id, inputContent, outputContent, isHidden]);
        }
    }

    console.log("✅ All problems synced to Database!");
    process.exit();
}

sync().catch(err => {
    console.error(err);
    process.exit(1);
});