'use client'

import Link from 'next/link'
import { Stethoscope, Microscope, FileText, BarChart3, FileQuestion } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'

export default function Home() {
  return (
    <div className="container mx-auto p-8">
      <div className="mb-8 text-center max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          Medical Consultation Assistant
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Enhance doctor-patient consultations with AI-powered transcription, 
          analysis, and diagnostic assistance
        </p>
      </div>

      <div className="max-w-2xl mx-auto">
        <Card className="border-2 border-blue-100 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-white">
            <div className="flex items-center gap-3">
              <Stethoscope className="h-8 w-8 text-blue-600" />
              <div>
                <CardTitle className="text-2xl">Consultation Workspace</CardTitle>
                <CardDescription className="text-base">
                  All-in-one consultation environment
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-gray-700 mb-6">
              Our unified consultation workspace combines all the tools you need:
            </p>
            
            <div className="grid gap-4">
              <div className="flex items-start gap-3">
                <Microscope className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h3 className="font-medium">Live Transcription</h3>
                  <p className="text-sm text-gray-600">Record and transcribe doctor-patient conversations in real-time</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <BarChart3 className="h-5 w-5 text-purple-600 mt-0.5" />
                <div>
                  <h3 className="font-medium">AI Analysis</h3>
                  <p className="text-sm text-gray-600">Identify symptoms and receive intelligent question suggestions</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <FileQuestion className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <h3 className="font-medium">Document Analysis</h3>
                  <p className="text-sm text-gray-600">Upload and analyze medical documents during consultations</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <h3 className="font-medium">Report Generation</h3>
                  <p className="text-sm text-gray-600">Create structured consultation reports with severity assessment</p>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center border-t pt-6 bg-gray-50">
            <Link href="/consultation">
              <Button size="lg" className="px-8">
                Open Consultation Workspace
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
} 