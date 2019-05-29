import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, Input, OnInit} from '@angular/core';
import {EventInterface} from 'quantified-self-lib/lib/events/event.interface';
import {EventService} from '../../services/app.event.service';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  FormGroupDirective,
  NgForm,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import {ErrorStateMatcher, MAT_DIALOG_DATA, MatDialogRef, MatSnackBar} from '@angular/material';
import * as Raven from 'raven-js';
import {User} from 'quantified-self-lib/lib/users/user';
import {Log} from 'ng2-logger/browser';
import {UserService} from '../../services/app.user.service';
import {MetaDataInterface, ServiceNames} from 'quantified-self-lib/lib/meta-data/meta-data.interface';
import {take} from 'rxjs/operators';
import {UserServiceMetaInterface} from 'quantified-self-lib/lib/users/user.service.meta.interface';


@Component({
  selector: 'app-activity-form',
  templateUrl: './history-import.form.component.html',
  styleUrls: ['./history-import.form.component.css'],
  providers: [],
})


export class HistoryImportFormComponent implements OnInit {
  protected logger = Log.create('ActivityFormComponent');

  public user: User;

  public formGroup: FormGroup;

  public userMetaForService: UserServiceMetaInterface;

  public isAllowedToDoHistoryImport = false;

  public isLoading: boolean;

  constructor(
    public dialogRef: MatDialogRef<HistoryImportFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private userService: UserService,
    private snackBar: MatSnackBar,
  ) {
    this.user = data.user;
  }

  async ngOnInit() {
    if (!this.user) {
      throw new Error('Component needs a user')
    }
    // Set this to loading
    this.isLoading = true;

    this.userMetaForService = await this.userService.getUserMetaForService(this.user, ServiceNames.SuuntoApp).pipe(take(1)).toPromise();

    // He is only allowed if he did it about 7 days ago
    this.isAllowedToDoHistoryImport = this.userMetaForService.didLastHistoryImport + 7 * 24 * 60 * 1000 < (new Date()).getTime();

    // Now build the controls
    this.formGroup = new FormGroup({
      formArray: new FormArray([
        new FormGroup({
          startDate: new FormControl(new Date(new Date().setHours(0, 0, 0, 0)), [
            Validators.required,
          ]),
          endDate: new FormControl(new Date(new Date().setHours(24, 0, 0, 0)), [
            Validators.required,
          ])
        }),
        new FormGroup({
          accepted: new FormControl(false, [
            Validators.requiredTrue,
            // Validators.minLength(4),
          ]),
        })
      ])
    });

    // Set this to done loading
    this.isLoading = false;
  }

  /** Returns a FormArray with the name 'formArray'. */
  get formArray(): AbstractControl | null {
    return this.formGroup.get('formArray');
  }

  hasError(formGroupIndex?: number, field?: string) {
    if (!field) {
      return !this.formGroup.valid;
    }
    const formArray = <FormArray>this.formGroup.get('formArray');
    return !(formArray.controls[formGroupIndex].get(field).valid && formArray.controls[formGroupIndex].get(field).touched);
  }

  async onSubmit() {
    event.preventDefault();
    if (!this.formGroup.valid) {
      this.validateAllFormFields(this.formGroup);
      return;
    }

    if (this.isLoading) {
      return;
    }

    this.isLoading = true;

    try {
      await this.userService.importSuuntoAppHistory(this.formGroup.get('formArray')['controls'][0].get('startDate'), this.formGroup.get('formArray')['controls'][0].get('endDate'));

      this.snackBar.open('History import started', null, {
        duration: 2000,
      });
    } catch (e) {
      // debugger;
      Raven.captureException(e);
      this.logger.error(e);
      this.snackBar.open(`Could import history due to ${e.toString()}`, null, {
        duration: 2000,
      });
      Raven.captureException(e);
    } finally {
      this.isLoading = false;
      this.dialogRef.close();
    }
  }

  validateAllFormFields(formGroup: FormGroup) {
    Object.keys(formGroup.controls).forEach(field => {
      const control = formGroup.get(field);
      if (control instanceof FormControl) {
        control.markAsTouched({onlySelf: true});
      } else if (control instanceof FormGroup) {
        this.validateAllFormFields(control);
      }
    });
  }

  close(event) {
    event.stopPropagation();
    event.preventDefault();
    this.dialogRef.close();
  }
}

