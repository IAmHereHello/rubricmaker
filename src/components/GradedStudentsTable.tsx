import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/StatusBadge';
import { useRubricStore } from '@/hooks/useRubricStore';
import { Download, Trash2, Users } from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { Rubric } from '@/types/rubric';

interface GradedStudentsTableProps {
  rubric: Rubric;
}

export function GradedStudentsTable({ rubric }: GradedStudentsTableProps) {
  const { clearGradedStudents } = useRubricStore();
  
  const students = rubric.gradedStudents || [];

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
        if (selectedColumnId) {
          const colIndex = rubric.columns.findIndex(c => c.id === selectedColumnId);
          if (rubric.scoringMode === 'cumulative') {
            for (let i = 0; i <= colIndex; i++) {
              score += rubric.columns[i].points;
            }
          } else {
            score = selectedColumn?.points || 0;
          }
        }
        
        rowData[`${row.name} - Level`] = selectedColumn?.name || '-';
        rowData[`${row.name} - Score`] = score;
        
        const cellFeedback = student.cellFeedback.find(
          f => f.rowId === row.id && f.columnId === selectedColumnId
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
            <Button variant="outline" onClick={() => clearGradedStudents(rubric.id)} size="sm">
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
            <Button onClick={exportToExcel} size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export to Excel
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
