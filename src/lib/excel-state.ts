import * as XLSX from 'xlsx';
import { StudentGradingData, Rubric } from '@/types/rubric';

export interface GradingSessionState {
    rubricId: string;
    currentRowIndex: number;
    studentOrder: string[];
    currentStudentIndex: number;
    studentsData: Record<string, StudentGradingData>; // Serialized Map
    timestamp: number;
    completedStudentCount: number;
}

export interface ExportData {
    rubric: Rubric;
    sessionState: GradingSessionState;
    initialStudentNames: string[];
    className: string;
}

export const exportGradingSession = (data: ExportData) => {
    const { rubric, sessionState, initialStudentNames, className } = data;

    // 1. Create Workbook
    const wb = XLSX.utils.book_new();

    // 2. Metadata Sheet
    const metadata = [
        ['Key', 'Value'],
        ['Type', 'RubricGradingSession'],
        ['Rubric Name', rubric.name],
        ['Rubric ID', rubric.id],
        ['Class Name', className],
        ['Exported At', new Date().toISOString()],
        ['Total Students', initialStudentNames.length],
        ['Current Row Index', sessionState.currentRowIndex],
        ['Completed Students', sessionState.completedStudentCount],
    ];
    const wsMeta = XLSX.utils.aoa_to_sheet(metadata);
    XLSX.utils.book_append_sheet(wb, wsMeta, 'Metadata');

    // 3. State Sheet (Hidden/Technical)
    // We confirm complex objects into a simple Key-Value for reconstruction
    // We will use a JSON string for the heavy lifting to ensure exact state restoration
    const stateData = [
        {
            key: 'rubricId',
            value: sessionState.rubricId
        },
        {
            key: 'currentRowIndex',
            value: sessionState.currentRowIndex
        },
        {
            key: 'currentStudentIndex',
            value: sessionState.currentStudentIndex
        },
        {
            key: 'timestamp',
            value: sessionState.timestamp
        },
        {
            key: 'studentOrder_JSON',
            value: JSON.stringify(sessionState.studentOrder)
        },
        {
            key: 'studentsData_JSON',
            value: JSON.stringify(sessionState.studentsData)
        },
        {
            key: 'initialStudentNames_JSON',
            value: JSON.stringify(initialStudentNames)
        }
    ];

    const wsState = XLSX.utils.json_to_sheet(stateData);
    XLSX.utils.book_append_sheet(wb, wsState, 'SessionData');

    // 4. Readable Progress Sheet (Optional, for user to see what's happening if they open it)
    const progressData = sessionState.studentOrder.map(name => {
        const student = sessionState.studentsData[name];
        return {
            'Student Name': name,
            'Cells Graded': student ? Object.keys(student.selections).length : 0,
            'Total Score So Far': 'N/A (Calculated on finish)'
        };
    });
    if (progressData.length > 0) {
        const wsProgress = XLSX.utils.json_to_sheet(progressData);
        XLSX.utils.book_append_sheet(wb, wsProgress, 'CurrentProgress');
    }

    // Generate filename
    const dateStr = new Date().toISOString().split('T')[0];
    const cleanClassName = className.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Grading_Save_${cleanClassName}_${dateStr}.xlsx`;

    // Download
    XLSX.writeFile(wb, filename);
};

export const importGradingSession = async (file: File): Promise<{
    sessionState: GradingSessionState;
    initialStudentNames: string[];
    className: string;
} | null> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const wb = XLSX.read(data, { type: 'binary' });

                // Check for SessionData sheet
                if (!wb.SheetNames.includes('SessionData')) {
                    console.error('Missing SessionData sheet');
                    reject(new Error('Invalid grading session file. Missing SessionData.'));
                    return;
                }

                // Read Metadata for className
                let className = 'Imported Class';
                if (wb.SheetNames.includes('Metadata')) {
                    const metaSheet = wb.Sheets['Metadata'];
                    const metaJson = XLSX.utils.sheet_to_json(metaSheet, { header: 1 }) as string[][];
                    const classRow = metaJson.find(row => row[0] === 'Class Name');
                    if (classRow && classRow[1]) {
                        className = classRow[1];
                    }
                }

                // Read SessionData
                const wsState = wb.Sheets['SessionData'];
                const stateRows = XLSX.utils.sheet_to_json(wsState) as { key: string, value: any }[];

                const stateMap: Record<string, any> = {};
                stateRows.forEach(row => {
                    stateMap[row.key] = row.value;
                });

                // Reconstruct objects
                const studentOrder = JSON.parse(stateMap['studentOrder_JSON'] || '[]');
                const studentsData = JSON.parse(stateMap['studentsData_JSON'] || '{}');
                const initialStudentNames = JSON.parse(stateMap['initialStudentNames_JSON'] || '[]');

                const sessionState: GradingSessionState = {
                    rubricId: stateMap['rubricId'],
                    currentRowIndex: Number(stateMap['currentRowIndex']),
                    currentStudentIndex: Number(stateMap['currentStudentIndex']),
                    timestamp: Number(stateMap['timestamp']),
                    completedStudentCount: studentOrder.length, // approximation or add to export
                    studentOrder,
                    studentsData
                };

                resolve({
                    sessionState,
                    initialStudentNames,
                    className
                });

            } catch (err) {
                console.error('Error parsing Excel', err);
                reject(err);
            }
        };

        reader.onerror = (err) => reject(err);
        reader.readAsBinaryString(file);
    });
};
