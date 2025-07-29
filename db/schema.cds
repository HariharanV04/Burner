namespace burner.db;

entity Employee {
  key ID         : String(10);   // Explicit primary key (business key-friendly)
  name           : String(100);
  department     : String(50);
  role           : String(100);

  // Associations to related entities
  workMetrics    : Composition of many Workmetrics on workMetrics.employee = $self;
  burnoutMetrics : Composition of many Burnoutmetrics on burnoutMetrics.employee = $self;
}

entity Workmetrics {
  key ID          : String(10);  // Explicit primary key
  work_hours      : Decimal(4,2);
  commute_hours   : Decimal(4,2);
  overtime_hours  : Decimal(4,2);
  leave_taken     : Integer;
  vacation_taken  : Integer;
  shift           : String(20);

  // Association back to employee
  employee        : Association to Employee;
}

entity Burnoutmetrics {
  key ID          : String(10);  // Explicit primary key
  risk_level      : String(20);
  cause           : LargeString;
  recommendation  : LargeString;

  // Association back to employee
  employee        : Association to Employee;
}
