namespace burner.db;

using { 
    cuid,           // Common UUID Key
    managed         // Audit fields (createdAt, createdBy, etc.)
} from '@sap/cds/common';


entity Employee : cuid, managed {
  name  : String(100);
  department : String(50);
  role  : String(100);

  // Associations to related entities
  workMetrics : Composition of many Workmetrics on workMetrics.employee = $self;
  burnoutMetrics : Composition of many Burnoutmetrics on burnoutMetrics.employee = $self;
}

entity Workmetrics : cuid, managed {
  work_hours : Decimal(4,2);
  commute_hours : Decimal(4,2);
  overtime_hours : Decimal(4,2);
  leave_taken : Integer;
  vacation_taken : Integer;
  shift : String(20);

  // Association back to employee
  employee : Association to Employee;
}

entity Burnoutmetrics : cuid,managed {
  risk_level : String(20);
  cause : LargeString;
  recommendation : LargeString;

  // Association back to employee
  employee : Association to Employee;
}