'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { LearnerProfile } from '@/types/database';
import { Upload, Download, User, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import LearnerCard from '@/components/LearnerCard';
import { api } from '@/lib/api';

type ImportedLearnerRow = {
  anonymous_id: string;
  profile_data: Record<string, unknown>;
};

export default function LearnerProfilesPage() {
  const [learners, setLearners] = useState<LearnerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const router = useRouter();

  const loadLearners = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getLearners();
      setLearners(data);
    } catch (err) {
      console.error('Failed to load learners:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLearners();
  }, [loadLearners]);

  const normalizeHeader = (header: string) => header.replace(/\s+/g, ' ').trim();

  const buildImportedLearners = (rows: Array<Record<string, unknown>>) => {
    return rows.reduce<ImportedLearnerRow[]>((acc, row) => {
      const normalizedRow = Object.entries(row).reduce<Record<string, unknown>>((result, entry) => {
        const [key, value] = entry;
        const normalizedKey = normalizeHeader(key);
        if (!normalizedKey || normalizedKey.startsWith('__EMPTY')) {
          return result;
        }
        result[normalizedKey] = typeof value === 'string' ? value.trim() : value;
        return result;
      }, {});

      if (Object.keys(normalizedRow).length === 0) {
        return acc;
      }

      const anonymousIdSource =
        normalizedRow.anonymous_id ||
        normalizedRow['Anonymous ID'] ||
        normalizedRow.AnonymousID ||
        normalizedRow.learner_id;

      const anonymousId = anonymousIdSource ? String(anonymousIdSource).trim() : '';

      delete normalizedRow.anonymous_id;
      delete normalizedRow['Anonymous ID'];
      delete normalizedRow.AnonymousID;
      delete normalizedRow.learner_id;

      acc.push({
        anonymous_id: anonymousId,
        profile_data: normalizedRow,
      });

      return acc;
    }, []);
  };

  const parseCSVRow = (row: string) => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < row.length; index += 1) {
      const char = row[index];
      const nextChar = row[index + 1];

      if (char === '"' && inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  };

  const parseCSV = (content: string) => {
    const lines = content.split(/\r?\n/);
    if (!lines[0]?.trim()) {
      return [];
    }

    const headers = parseCSVRow(lines[0]).map((header) => normalizeHeader(header));
    if (headers.length === 0) {
      throw new Error('The CSV header row is empty.');
    }

    const rows = [];
    for (let i = 1; i < lines.length; i += 1) {
      if (!lines[i].trim()) continue;

      const values = parseCSVRow(lines[i]);
      const row: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] ?? '';
      });
      rows.push(row);
    }

    return buildImportedLearners(rows);
  };

  const parseWorkbook = async (file: File) => {
    if (file.name.toLowerCase().endsWith('.csv')) {
      const content = await file.text();
      return parseCSV(content);
    }

    const data = await file.arrayBuffer();
    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(data);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw new Error('The spreadsheet does not contain any sheets.');
    }
    if (worksheet.rowCount > 1001) {
      throw new Error('Import a maximum of 1000 learner rows at a time.');
    }

    const headerRow = worksheet.getRow(1);
    const headers = Array.from({ length: worksheet.columnCount }, (_, index) =>
      normalizeHeader(String(headerRow.getCell(index + 1).text || '')),
    );
    const rows: Array<Record<string, unknown>> = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const record: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        if (!header) return;
        record[header] = row.getCell(index + 1).text.trim();
      });
      if (Object.values(record).some((value) => String(value).trim())) {
        rows.push(record);
      }
    });

    if (rows.length === 0) {
      throw new Error('The spreadsheet did not contain any learner rows.');
    }

    return buildImportedLearners(rows);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setUploadMessage('The learner file must be 5 MB or smaller.');
      event.target.value = '';
      return;
    }

    const allowedExtensions = ['.csv', '.xlsx'];
    const lowerName = file.name.toLowerCase();
    if (!allowedExtensions.some((extension) => lowerName.endsWith(extension))) {
      setUploadMessage('Upload a CSV or XLSX learner file.');
      event.target.value = '';
      return;
    }

    setUploading(true);
    setUploadMessage('');

    try {
      const parsedData = await parseWorkbook(file);
      if (parsedData.length === 0) {
        throw new Error('The file did not contain any learner rows.');
      }

      await api.bulkUploadLearners(parsedData);
      await loadLearners();
      setUploadMessage(`Uploaded ${parsedData.length} learner row(s).`);
    } catch (err) {
      console.error('Upload failed:', err);
      setUploadMessage(
        err instanceof Error ? err.message : 'Upload failed. Please check the file format.',
      );
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleDownloadProfiles = () => {
    const csvContent = convertToCSV(learners);
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `learner_profiles_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const convertToCSV = (data: LearnerProfile[]) => {
    if (data.length === 0) return '';

    const headers = ['Anonymous ID', 'Created At', 'Updated At'];
    const rows = data.map((learner) => [
      learner.anonymous_id,
      new Date(learner.created_at).toLocaleDateString(),
      new Date(learner.updated_at).toLocaleDateString(),
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  };

  return (
    <DashboardLayout activeTab="tools">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/tools')}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-slate-800">Learner Profiles</h2>
            <p className="text-slate-600 mt-1">
              Manage anonymized learner data with privacy protection
            </p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="font-semibold text-amber-900 mb-2">Privacy & Anonymization</h3>
          <p className="text-sm text-amber-800">
            All learner data is automatically anonymized to protect student privacy. Personal
            identifying information is replaced with anonymous IDs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border-2 border-dashed border-slate-300 rounded-xl p-6 hover:border-blue-400 transition">
            <label className="cursor-pointer block">
              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
              <div className="text-center">
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                <p className="font-medium text-slate-800 mb-1">Upload Learner Data</p>
                <p className="text-sm text-slate-500">CSV or XLSX files</p>
                {uploading && <p className="text-sm text-blue-600 mt-2">Uploading...</p>}
              </div>
            </label>
          </div>

          <button
            onClick={handleDownloadProfiles}
            disabled={learners.length === 0}
            className="bg-white border-2 border-slate-200 rounded-xl p-6 hover:border-green-400 hover:shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="text-center">
              <Download className="w-8 h-8 text-slate-400 mx-auto mb-3" />
              <p className="font-medium text-slate-800 mb-1">Download Profiles</p>
              <p className="text-sm text-slate-500">Export updated learner data</p>
            </div>
          </button>

          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
            <div className="text-center">
              <User className="w-8 h-8 text-blue-600 mx-auto mb-3" />
              <p className="font-medium text-slate-800 mb-1">Total Profiles</p>
              <p className="text-3xl font-bold text-blue-600">{learners.length}</p>
            </div>
          </div>
        </div>

        {uploadMessage && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {uploadMessage}
          </div>
        )}

        <div>
          <h3 className="text-xl font-semibold text-slate-800 mb-4">
            Learner Cards ({learners.length})
          </h3>

          {loading ? (
            <div className="text-center py-12 text-slate-500">Loading profiles...</div>
          ) : learners.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <User className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h4 className="text-lg font-semibold text-slate-800 mb-2">
                No Learner Profiles Yet
              </h4>
              <p className="text-slate-600 mb-4">
                Upload learner data to create anonymized profiles
              </p>
              <p className="text-sm text-slate-500">Supported formats: CSV and XLSX</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {learners.map((learner) => (
                <LearnerCard key={learner.id} learner={learner} onUpdate={loadLearners} />
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
