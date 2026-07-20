"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from 'date-fns';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { FileText, CalendarIcon, FileBarChart, TrendingUp, ArrowLeft } from "lucide-react";

export default function ReportsPage() {
  const router = useRouter();
  
  // State for date filters
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  
  // State for report selections
  const [preparatoryReport, setPreparatoryReport] = useState("");
  const [autoconerReport, setAutoconerReport] = useState("");
  const [spinningReport, setSpinningReport] = useState("");

  // Report options
  const preparatoryReports = [
    { value: "all-siders", label: "PREPARATORY ALL SIDERS PERFORMANCE REPORT" },
    { value: "waste-abstract", label: "PREPARATORY WASTE ABSTRACT REPORT" },
    { value: "stoppage-percentage", label: "PREPARATORY STOPPAGE PERCENTAGE REPORT" }
  ];

  const autoconerReports = [
    { value: "particular-sider", label: "AUTOCONER PARTICULAR SIDER REPORT" },
    { value: "efficiency", label: "AUTOCONER EFFICIENCY REPORT" },
    { value: "low-efficiency", label: "AUTOCONER LOW EFFICIENCY REPORT" },
    { value: "count-wise-production", label: "AUTOCONER COUNT-WISE PRODUCTION REPORT" },
    { value: "stoppage-percentage", label: "AUTOCONER STOPPAGE PERCENTAGE REPORT" },
    { value: "abstract", label: "AUTOCONER ABSTRACT REPORT" }
  ];

  const spinningReports = [
    { value: "stoppage-percentage", label: "SPINNING STOPPAGE PERCENTAGE REPORT" },
    { value: "shift-count-wise", label: "SPINNING SHIFT AND COUNT WISE PRODUCTION REPORT" },
    { value: "daily-production", label: "SPINNING DAILY PRODUCTION REPORT" },
    { value: "production-abstract", label: "SPINNING PRODUCTION ABSTRACT REPORT" },
    { value: "sider-monthly", label: "SPINNING SIDER MONTHLY REPORT" },
    { value: "machine-wise-production", label: "SPINNING MACHINE WISE PRODUCTION REPORT" }
  ];

  // Handle report generation
  const handleGenerateReport = (reportType, category) => {
    if (category === 'preparatory' && reportType === 'stoppage-percentage') {
      router.push('/reports/preparatory/stoppage-percentage')
    } else if (category === 'preparatory' && reportType === 'waste-abstract') {
      router.push('/reports/preparatory/waste-abstract')
    } else if (category === 'preparatory' && reportType === 'all-siders') {
      router.push('/reports/preparatory/sider-performance')
    } else if (category === 'autoconer' && reportType === 'low-efficiency') {
      router.push('/reports/autoconer/low-efficiency')
    } else if (category === 'autoconer' && reportType === 'particular-sider') {
      router.push('/reports/autoconer/particular-sider')
    } else if (category === 'autoconer' && reportType === 'efficiency') {
      router.push('/reports/autoconer/efficiency')
    } else if (category === 'autoconer' && reportType === 'count-wise-production') {
      router.push('/reports/autoconer/count-wise-production')
    } else if (category === 'autoconer' && reportType === 'stoppage-percentage') {
      router.push('/reports/autoconer/stoppage-percentage')
    } else if (category === 'autoconer' && reportType === 'abstract') {
      router.push('/reports/autoconer/abstract')
    } else if (category === 'spinning' && reportType === 'stoppage-percentage') {
      router.push('/reports/spinning/stoppage-percentage')
    } else if (category === 'spinning' && reportType === 'shift-count-wise') {
      router.push('/reports/spinning/shift-count-production')
    } else if (category === 'spinning' && reportType === 'daily-production') {
      router.push('/reports/spinning/daily-production')
    } else if (category === 'spinning' && reportType === 'production-abstract') {
      router.push('/reports/spinning/production-abstract')
    } else if (category === 'spinning' && reportType === 'sider-monthly') {
      router.push('/reports/spinning/sider-monthly')
    } else if (category === 'spinning' && reportType === 'machine-wise-production') {
      router.push('/reports/spinning/machine-wise-production')
    } else {
      // Future implementation for other reports
      alert(`Report generation for ${reportType} coming soon!`)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <Card className="bg-linear-to-r from-blue-600 to-blue-700 text-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileBarChart className="h-8 w-8" />
              <div>
                <CardTitle className="text-2xl">Production Reports</CardTitle>
                <CardDescription className="text-blue-100">
                  Generate and view production reports and analytics
                </CardDescription>
              </div>
            </div>
            <Link href="/">
              <Button variant="secondary" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Button>
            </Link>
          </div>
        </CardHeader>
      </Card>

      {/* Date Range Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Date Range Selection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            {/* From Date */}
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">From Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-45 justify-start text-left font-normal",
                      !fromDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fromDate ? format(fromDate, "dd-MMM-yy") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={fromDate}
                    onSelect={(d) => d && setFromDate(d)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* To Date */}
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">To Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-45 justify-start text-left font-normal",
                      !toDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {toDate ? format(toDate, "dd-MMM-yy") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={toDate}
                    onSelect={(d) => d && setToDate(d)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Selection Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Preparatory Reports */}
        <Card className="border-2 border-blue-200 hover:shadow-lg transition-all">
          <CardHeader className="bg-blue-50">
            <div className="flex items-center gap-2">
              <div className="text-3xl">🏭</div>
              <div>
                <CardTitle className="text-lg text-blue-700">Preparatory Reports</CardTitle>
                <CardDescription className="text-sm">Carding, Drawing, Comber, Simplex</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Select Report Type</Label>
              <Select value={preparatoryReport} onValueChange={setPreparatoryReport}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a report..." />
                </SelectTrigger>
                <SelectContent>
                  {preparatoryReports.map((report) => (
                    <SelectItem key={report.value} value={report.value}>
                      {report.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={!preparatoryReport}
                onClick={() => handleGenerateReport(preparatoryReport, 'preparatory')}
              >
                <FileText className="h-4 w-4 mr-2" />
                Generate Report
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Autoconer Reports */}
        <Card className="border-2 border-green-200 hover:shadow-lg transition-all">
          <CardHeader className="bg-green-50">
            <div className="flex items-center gap-2">
              <div className="text-3xl">🔧</div>
              <div>
                <CardTitle className="text-lg text-green-700">Autoconer Reports</CardTitle>
                <CardDescription className="text-sm">Automation & Efficiency</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Select Report Type</Label>
              <Select value={autoconerReport} onValueChange={setAutoconerReport}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a report..." />
                </SelectTrigger>
                <SelectContent>
                  {autoconerReports.map((report) => (
                    <SelectItem key={report.value} value={report.value}>
                      {report.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={!autoconerReport}
                onClick={() => handleGenerateReport(autoconerReport, 'autoconer')}
              >
                <FileText className="h-4 w-4 mr-2" />
                Generate Report
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Spinning Reports */}
        <Card className="border-2 border-purple-200 hover:shadow-lg transition-all">
          <CardHeader className="bg-purple-50">
            <div className="flex items-center gap-2">
              <div className="text-3xl">🧵</div>
              <div>
                <CardTitle className="text-lg text-purple-700">Spinning Reports</CardTitle>
                <CardDescription className="text-sm">Ring Frame Production</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Select Report Type</Label>
              <Select value={spinningReport} onValueChange={setSpinningReport}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a report..." />
                </SelectTrigger>
                <SelectContent>
                  {spinningReports.map((report) => (
                    <SelectItem key={report.value} value={report.value}>
                      {report.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                className="w-full bg-purple-600 hover:bg-purple-700"
                disabled={!spinningReport}
                onClick={() => handleGenerateReport(spinningReport, 'spinning')}
              >
                <FileText className="h-4 w-4 mr-2" />
                Generate Report
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>


    </div>
  );
}
