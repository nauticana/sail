import { Int64 } from '../util/integer';

/** One keel `approval_policy` row in Sail's generic REST field shape. */
export interface ApprovalPolicy {
  Id:                Int64;
  PartnerId:         Int64;
  /** An approval_request object type or a document_type id. */
  ObjectType:        string;
  AllowSinglePerson: boolean;
  ChangedBy:         Int64;
  ConfirmedBy:       Int64 | null;
  /** Null while the change waits for another administrator's confirmation. */
  Begda:             string | null;
  Endda:             string | null;
}

/** A review kind the app offers a policy for, with its display caption. */
export interface ApprovalReviewKind {
  objectType: string;
  caption:    string;
}

/** keel's `OpenPolicy`: an owner's open rule, and the answer to set and confirm. */
export interface ApprovalPolicyChange {
  objectType:        string;
  allowSinglePerson: boolean;
  /** False while allowing one person waits for another administrator's confirmation. */
  inForce:           boolean;
}
