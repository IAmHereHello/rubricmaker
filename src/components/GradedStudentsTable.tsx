import { format } from 'date-fns';
import { generatePdf } from '@/lib/pdf-generator';
import { ChevronDown, Download, FileText, Trash2, Users } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRubricStore } from '@/hooks/useRubricStore';
import { StatusBadge } from '@/components/StatusBadge';
import { GradedStudent, Rubric } from '@/types/rubric';

interface GradedStudentsTableProps {
  rubric: Rubric;
  students?: GradedStudent[];
  hideClear?: boolean;
}

export function GradedStudentsTable({ rubric, students: propStudents, hideClear = false }: GradedStudentsTableProps) {
  const { clearGradedStudents } = useRubricStore();

  const students = propStudents || rubric.gradedStudents || [];

  const exportToPDF = (studentId?: string) => {
    const targetStudents = studentId
      ? students.filter(s => s.id === studentId)
      : students;

    if (targetStudents.length === 0) return;

    generatePdf(rubric, targetStudents);
  };

  const exportToExcel = () => {
    if (students.length === 0) return;

    // Build data for Excel
    const data = students.map((student) => {
      const rowData: Record<string, any> = {
        'Student Name': student.studentName,
        'Total Score': student.totalScore,
        'Final Status': student.statusLabel,
        'General Feedback': student.generalFeedback || '-',
        'Graded At': format(new Date(student.gradedAt), 'MMM d, yyyy HH:mm'),
      };

      // Add individual row scores and feedback
      rubric.rows.forEach((row) => {
        const selectedColumnId = student.selections[row.id];
        const selectedColumn = rubric.columns.find(c => c.id === selectedColumnId);

        // Calculate score based on scoring mode
        let score = 0;
        if (rubric.type === 'exam') {
          score = student.rowScores?.[row.id] || 0;
        } else if (selectedColumnId) {
          const colIndex = rubric.columns.findIndex(c => c.id === selectedColumnId);
          if (rubric.scoringMode === 'cumulative') {
            for (let i = 0; i <= colIndex; i++) {
              score += rubric.columns[i].points;
            }
          } else {
            score = selectedColumn?.points || 0;
          }
        }

        // Add calc points
        if (row.calculationPoints && row.calculationPoints > 0) {
          const isCorrect = student.calculationCorrect?.[row.id] !== false;
          if (isCorrect) score += row.calculationPoints;
          rowData[`${row.name} - Calc`] = isCorrect ? 'Correct' : 'Incorrect';
        }

        rowData[`${row.name} - Level`] = rubric.type === 'exam' ? 'N/A' : (selectedColumn?.name || '-');
        rowData[`${row.name} - Score`] = score;

        const cellFeedback = student.cellFeedback.find(
          f => f.rowId === row.id && (rubric.type === 'exam' ? (f.columnId === 'manual' || !f.columnId) : f.columnId === selectedColumnId)
        );
        rowData[`${row.name} - Feedback`] = cellFeedback?.feedback || '-';
      });

      return rowData;
    });

    // Create workbook and worksheet
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Graded Students');

    // Auto-size columns
    const colWidths = Object.keys(data[0] || {}).map(key => ({
      wch: Math.max(key.length, 15)
    }));
    ws['!cols'] = colWidths;

    // Download file
    XLSX.writeFile(wb, `${rubric.name}_class_results.xlsx`);
  };

  if (students.length === 0) {
    return null;
  }

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Graded Students ({students.length})
            </CardTitle>
            <CardDescription>
              Students graded with this rubric
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {!hideClear && (
              <Button variant="outline" onClick={() => clearGradedStudents(rubric.id)} size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  Export PDF
                  <ChevronDown className="ml-2 h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>PDF Options</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => exportToPDF()}>
                  Download Class Bundle (All)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Individual Students</DropdownMenuLabel>
                <div className="max-h-[200px] overflow-y-auto">
                  {students.map(student => (
                    <DropdownMenuItem key={student.id} onClick={() => exportToPDF(student.id)}>
                      {student.studentName}
                    </DropdownMenuItem>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button onClick={exportToExcel} size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student Name</TableHead>
                <TableHead className="text-center">Score</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Graded At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow key={student.id}>
                  <TableCell className="font-medium">{student.studentName}</TableCell>
                  <TableCell className="text-center">
                    <span className="font-semibold text-primary">{student.totalScore}</span>
                    <span className="text-muted-foreground text-sm"> / {rubric.totalPossiblePoints}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusBadge status={student.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(student.gradedAt), 'MMM d, yyyy HH:mm')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
